import { describe, it, expect } from 'vitest';
import { createProject, Project } from './project';
import {
  splitClip,
  moveClip,
  trimClip,
  deleteClip,
  resolveActiveClip,
  snapFrame,
  addClip,
} from './timeline';

function projectWithClip(startFrame = 10, endFrame = 40): Project {
  const project = createProject('Test');
  project.assets.push({
    id: 'asset-1',
    name: 'video.mp4',
    mimeType: 'video/mp4',
    durationInSeconds: 2,
    durationInFrames: 60,
    width: 1920,
    height: 1080,
  });
  project.clips.push({
    id: 'clip-a',
    assetId: 'asset-1',
    trackId: 'v1',
    timelineStartFrame: startFrame,
    sourceInFrame: 0,
    sourceOutFrame: endFrame - startFrame, // 30 frames
    opacity: 1,
    volume: 1,
    muted: false,
    effect: 'none',
  });
  return project;
}

describe('Timeline engine', () => {
  it('splits a clip cleanly at frame and updates source boundaries', () => {
    const split = splitClip(projectWithClip(10, 40), 'clip-a', 25);
    expect(split.clips).toHaveLength(2);
    expect(split.clips.map(({ sourceInFrame, sourceOutFrame }) => [sourceInFrame, sourceOutFrame]))
      .toEqual([[0, 15], [15, 30]]);
    expect(split.clips.map(({ timelineStartFrame }) => timelineStartFrame))
      .toEqual([10, 25]);
  });

  it('rejects invalid splits outside clip boundaries', () => {
    const project = projectWithClip(10, 40);
    expect(() => splitClip(project, 'clip-a', 10)).toThrow('INVALID_SPLIT');
    expect(() => splitClip(project, 'clip-a', 40)).toThrow('INVALID_SPLIT');
    expect(() => splitClip(project, 'clip-a', 5)).toThrow('INVALID_SPLIT');
  });

  it('rejects clip overlap on the same track', () => {
    const project = projectWithClip(10, 40);
    project.clips.push({
      id: 'clip-b',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 50,
      sourceInFrame: 0,
      sourceOutFrame: 20,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    });

    expect(() => moveClip(project, 'clip-b', 'v1', 20))
      .toThrow('CLIP_OVERLAP');
  });

  it('allows moving clip to a non-overlapping position or another track', () => {
    const project = projectWithClip(10, 40);
    const moved = moveClip(project, 'clip-a', 'v1', 50);
    expect(moved.clips[0].timelineStartFrame).toBe(50);
    expect(moved.clips[0].trackId).toBe('v1');
  });

  it('trims the start of a clip correctly', () => {
    const project = projectWithClip(10, 40);
    const trimmed = trimClip(project, 'clip-a', 'start', 15);
    expect(trimmed.clips[0].timelineStartFrame).toBe(15);
    expect(trimmed.clips[0].sourceInFrame).toBe(5);
    expect(trimmed.clips[0].sourceOutFrame).toBe(30);
  });

  it('trims the end of a clip correctly', () => {
    const project = projectWithClip(10, 40);
    const trimmed = trimClip(project, 'clip-a', 'end', 35);
    expect(trimmed.clips[0].timelineStartFrame).toBe(10);
    expect(trimmed.clips[0].sourceInFrame).toBe(0);
    expect(trimmed.clips[0].sourceOutFrame).toBe(25);
  });

  it('rejects invalid trims that invert or empty the clip', () => {
    const project = projectWithClip(10, 40);
    expect(() => trimClip(project, 'clip-a', 'start', 40)).toThrow('INVALID_TRIM');
    expect(() => trimClip(project, 'clip-a', 'end', 10)).toThrow('INVALID_TRIM');
  });

  it('rejects trims that cause overlap on the track', () => {
    const project = projectWithClip(10, 40);
    project.clips.push({
      id: 'clip-b',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 45,
      sourceInFrame: 0,
      sourceOutFrame: 20,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    });
    // Extending clip-a end past 45 will overlap clip-b
    expect(() => trimClip(project, 'clip-a', 'end', 50)).toThrow('CLIP_OVERLAP');
  });

  it('deletes a clip', () => {
    const project = projectWithClip(10, 40);
    const deleted = deleteClip(project, 'clip-a');
    expect(deleted.clips).toHaveLength(0);
  });

  it('resolves the active video clip for a frame', () => {
    const project = projectWithClip(10, 40);
    expect(resolveActiveClip(project, 9)).toBeNull();
    expect(resolveActiveClip(project, 10)?.id).toBe('clip-a');
    expect(resolveActiveClip(project, 25)?.id).toBe('clip-a');
    expect(resolveActiveClip(project, 39)?.id).toBe('clip-a');
    expect(resolveActiveClip(project, 40)).toBeNull();
  });

  it('adds a clip and rejects overlap on add', () => {
    const project = projectWithClip(10, 40);
    const added = addClip(project, {
      id: 'clip-c',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 50,
      sourceInFrame: 0,
      sourceOutFrame: 10,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    });
    expect(added.clips).toHaveLength(2);

    expect(() => addClip(project, {
      id: 'clip-d',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 20,
      sourceInFrame: 0,
      sourceOutFrame: 10,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    })).toThrow('CLIP_OVERLAP');
  });

  it('snaps frames to targets within threshold', () => {
    const snapPoints = [0, 30, 60, 90];
    expect(snapFrame(28, snapPoints, 5)).toBe(30);
    expect(snapFrame(32, snapPoints, 5)).toBe(30);
    expect(snapFrame(20, snapPoints, 5)).toBe(20);
  });
});
