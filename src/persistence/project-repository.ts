import { Project, Clip } from '../domain/project';

const DB_NAME = 'cutline-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

// In-memory fallback for headless or non-IndexedDB environments
const inMemoryStore = new Map<string, Project>();

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project: Project): Promise<void> {
  inMemoryStore.set(project.id, JSON.parse(JSON.stringify(project)));

  if (typeof indexedDB === 'undefined') {
    return;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(JSON.parse(JSON.stringify(project)));

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fall back to inMemoryStore silently if IndexedDB fails
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  if (typeof indexedDB === 'undefined') {
    return inMemoryStore.get(id) || null;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as Project);
        } else {
          resolve(inMemoryStore.get(id) || null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return inMemoryStore.get(id) || null;
  }
}

export function markOfflineAssets(
  project: Project,
  availableAssetIds: Set<string>
): Clip[] {
  return project.clips.map((clip) => {
    const isAvailable = availableAssetIds.has(clip.assetId);
    return {
      ...clip,
      status: isAvailable ? 'online' : 'offline',
    };
  });
}
