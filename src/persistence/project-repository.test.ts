import { describe, it, expect } from 'vitest';
import { createProject } from '../domain/project';
import {
  saveProject,
  loadProject,
  markOfflineAssets,
} from './project-repository';

describe('Project persistence & offline detection', () => {
  const project = createProject('Persistence Test', 30);
  project.clips.push({
    id: 'clip-1',
    assetId: 'asset-1',
    trackId: 'v1',
    timelineStartFrame: 0,
    sourceInFrame: 0,
    sourceOutFrame: 60,
    opacity: 1,
    volume: 1,
    muted: false,
    effect: 'none',
  });

  it('saves and restores project metadata', async () => {
    await saveProject(project);
    expect(await loadProject(project.id)).toEqual(project);
  });

  it('marks clips offline when asset is unavailable', () => {
    const clips = markOfflineAssets(project, new Set());
    expect(clips).toContainEqual(expect.objectContaining({ status: 'offline' }));

    const onlineClips = markOfflineAssets(project, new Set(['asset-1']));
    expect(onlineClips[0].status).toBe('online');
  });
});
