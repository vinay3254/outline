import { create } from 'zustand';
import { Project, createProject, Clip, Asset } from '../domain/project';
import {
  HistoryState,
  createHistory,
  applyCommand,
  undo,
  redo,
  canUndo,
  canRedo,
} from '../domain/history';
import {
  splitClip,
  trimClip,
  moveClip,
  deleteClip,
  updateClip,
  addClip,
  TrimEdge,
  TimelineError,
} from '../domain/timeline';
import { saveProject } from '../persistence/project-repository';

export interface Notice {
  message: string;
  type: 'info' | 'error' | 'warning';
}

export interface EditorState {
  history: HistoryState;
  project: Project;
  selectedClipId: string | null;
  playheadFrame: number;
  isPlaying: boolean;
  timelineZoom: number; // pixels per frame
  assetUrls: Record<string, string>;
  notice: Notice | null;

  // Actions
  setProject: (project: Project) => void;
  executeCommand: (description: string, mutate: (p: Project) => Project) => boolean;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  selectClip: (clipId: string | null) => void;
  setPlayheadFrame: (frame: number) => void;
  stepFrame: (delta: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setTimelineZoom: (zoom: number | ((prev: number) => number)) => void;
  setNotice: (notice: Notice | null) => void;
  registerAssetUrl: (assetId: string, url: string) => void;
  addAsset: (asset: Asset, objectUrl: string) => void;
  addClipFromAsset: (assetId: string, trackId?: string, startFrame?: number) => void;
  addAssetWithClip: (asset: Asset, objectUrl: string, trackId?: string, startFrame?: number) => void;
  
  // Specific commands
  splitAtPlayhead: () => void;
  deleteSelectedClip: () => void;
  moveClipTo: (clipId: string, trackId: string, startFrame: number) => boolean;
  trimClipEdge: (clipId: string, edge: TrimEdge, frame: number) => boolean;
  updateClipProps: (clipId: string, updates: Partial<Omit<Clip, 'id'>>) => void;
}

const initialProject = createProject('Untitled Project', 30);
const initialHistory = createHistory(initialProject);

export const useEditorStore = create<EditorState>((set, get) => ({
  history: initialHistory,
  project: initialProject,
  selectedClipId: null,
  playheadFrame: 0,
  isPlaying: false,
  timelineZoom: 4, // 4 pixels per frame
  assetUrls: {},
  notice: null,

  setProject: (project: Project) => {
    const history = createHistory(project);
    set({
      history,
      project,
      selectedClipId: null,
      playheadFrame: 0,
    });
    saveProject(project).catch(() => {});
  },

  executeCommand: (description: string, mutate: (p: Project) => Project): boolean => {
    try {
      const currentHistory = get().history;
      const nextHistory = applyCommand(currentHistory, description, mutate);
      set({
        history: nextHistory,
        project: nextHistory.present,
      });
      saveProject(nextHistory.present).catch(() => {});
      return true;
    } catch (err: unknown) {
      if (err instanceof TimelineError || err instanceof Error) {
        set({ notice: { message: err.message, type: 'error' } });
      }
      return false;
    }
  },

  undo: () => {
    const nextHistory = undo(get().history);
    set({
      history: nextHistory,
      project: nextHistory.present,
    });
    saveProject(nextHistory.present).catch(() => {});
  },

  redo: () => {
    const nextHistory = redo(get().history);
    set({
      history: nextHistory,
      project: nextHistory.present,
    });
    saveProject(nextHistory.present).catch(() => {});
  },

  canUndo: () => canUndo(get().history),
  canRedo: () => canRedo(get().history),

  selectClip: (clipId: string | null) => {
    set({ selectedClipId: clipId });
  },

  setPlayheadFrame: (frame: number) => {
    set({ playheadFrame: Math.max(0, Math.round(frame)) });
  },

  stepFrame: (delta: number) => {
    set((state) => ({
      playheadFrame: Math.max(0, state.playheadFrame + delta),
    }));
  },

  setIsPlaying: (isPlaying: boolean) => {
    set({ isPlaying });
  },

  setTimelineZoom: (zoom: number | ((prev: number) => number)) => {
    set((state) => {
      const next = typeof zoom === 'function' ? zoom(state.timelineZoom) : zoom;
      return { timelineZoom: Math.max(0.5, Math.min(50, next)) };
    });
  },

  setNotice: (notice: Notice | null) => {
    set({ notice });
  },

  registerAssetUrl: (assetId: string, url: string) => {
    set((state) => ({
      assetUrls: { ...state.assetUrls, [assetId]: url },
    }));
  },

  addAsset: (asset: Asset, objectUrl: string) => {
    const state = get();
    state.registerAssetUrl(asset.id, objectUrl);
    state.executeCommand('Import asset', (proj) => {
      const updatedAssets = proj.assets.some((a) => a.id === asset.id)
        ? proj.assets
        : [...proj.assets, asset];
      return { ...proj, assets: updatedAssets };
    });
  },

  addClipFromAsset: (assetId: string, trackId = 'v1', startFrame?: number) => {
    const state = get();
    const asset = state.project.assets.find((a) => a.id === assetId);
    if (!asset) return;

    state.executeCommand('Add Clip to Timeline', (proj) => {
      let targetStart = startFrame ?? 0;
      if (startFrame === undefined) {
        const clipsOnTrack = proj.clips.filter((c) => c.trackId === trackId);
        if (clipsOnTrack.length > 0) {
          targetStart = Math.max(
            ...clipsOnTrack.map((c) => c.timelineStartFrame + (c.sourceOutFrame - c.sourceInFrame))
          );
        }
      }

      const newClip: Clip = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `clip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        trackId,
        timelineStartFrame: targetStart,
        sourceInFrame: 0,
        sourceOutFrame: asset.durationInFrames,
        opacity: 1,
        volume: 1,
        muted: false,
        effect: 'none',
      };

      set({
        selectedClipId: newClip.id,
        playheadFrame: targetStart + Math.floor(asset.durationInFrames / 2),
      });

      return addClip(proj, newClip);
    });
  },

  addAssetWithClip: (asset: Asset, objectUrl: string, trackId = 'v1', startFrame?: number) => {
    const state = get();
    state.registerAssetUrl(asset.id, objectUrl);

    state.executeCommand('Add Asset and Clip', (proj) => {
      const updatedAssets = proj.assets.some((a) => a.id === asset.id)
        ? proj.assets
        : [...proj.assets, asset];

      let targetStart = startFrame ?? 0;
      if (startFrame === undefined) {
        // place after the last clip on track
        const clipsOnTrack = proj.clips.filter((c) => c.trackId === trackId);
        if (clipsOnTrack.length > 0) {
          targetStart = Math.max(
            ...clipsOnTrack.map((c) => c.timelineStartFrame + (c.sourceOutFrame - c.sourceInFrame))
          );
        }
      }

      const newClip: Clip = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `clip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        trackId,
        timelineStartFrame: targetStart,
        sourceInFrame: 0,
        sourceOutFrame: asset.durationInFrames,
        opacity: 1,
        volume: 1,
        muted: false,
        effect: 'none',
      };

      set({
        selectedClipId: newClip.id,
        playheadFrame: targetStart + Math.floor(asset.durationInFrames / 2),
      });

      const withAsset: Project = { ...proj, assets: updatedAssets };
      return addClip(withAsset, newClip);
    });
  },

  splitAtPlayhead: () => {
    const { project, playheadFrame, selectedClipId } = get();
    // If a clip is selected and playhead is within it, split that clip.
    // Otherwise split any clip intersecting playhead on the primary video track.
    let targetClipId = selectedClipId;
    if (!targetClipId) {
      const intersecting = project.clips.find(
        (c) =>
          c.timelineStartFrame < playheadFrame &&
          playheadFrame < c.timelineStartFrame + (c.sourceOutFrame - c.sourceInFrame)
      );
      if (intersecting) targetClipId = intersecting.id;
    }

    if (!targetClipId) return;

    get().executeCommand('Split clip', (proj) => splitClip(proj, targetClipId!, playheadFrame));
  },

  deleteSelectedClip: () => {
    const { selectedClipId } = get();
    if (!selectedClipId) return;
    get().executeCommand('Delete clip', (proj) => deleteClip(proj, selectedClipId));
    set({ selectedClipId: null });
  },

  moveClipTo: (clipId: string, trackId: string, startFrame: number) => {
    return get().executeCommand('Move clip', (proj) =>
      moveClip(proj, clipId, trackId, startFrame)
    );
  },

  trimClipEdge: (clipId: string, edge: TrimEdge, frame: number) => {
    return get().executeCommand('Trim clip', (proj) =>
      trimClip(proj, clipId, edge, frame)
    );
  },

  updateClipProps: (clipId: string, updates: Partial<Omit<Clip, 'id'>>) => {
    get().executeCommand('Update clip properties', (proj) =>
      updateClip(proj, clipId, updates)
    );
  },
}));
