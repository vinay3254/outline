import { describe, it, expect } from 'vitest';
import { createProject } from './project';
import { moveClip } from './timeline';
import {
  createHistory,
  applyCommand,
  undo,
  redo,
  canUndo,
  canRedo,
} from './history';

describe('History state machine', () => {
  it('supports applyCommand, undo, and redo', () => {
    const project = createProject('History Test');
    project.clips.push({
      id: 'clip-a',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 10,
      sourceInFrame: 0,
      sourceOutFrame: 30,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    });

    const history = createHistory(project);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);

    const afterMove = applyCommand(history, 'Move clip', p => moveClip(p, 'clip-a', 'v1', 42));
    expect(canUndo(afterMove)).toBe(true);
    expect(canRedo(afterMove)).toBe(false);
    expect(afterMove.present.clips[0].timelineStartFrame).toBe(42);

    const afterUndo = undo(afterMove);
    expect(afterUndo.present.clips[0].timelineStartFrame).toBe(10);
    expect(canUndo(afterUndo)).toBe(false);
    expect(canRedo(afterUndo)).toBe(true);

    const afterRedo = redo(afterUndo);
    expect(afterRedo.present.clips[0].timelineStartFrame).toBe(42);
    expect(canUndo(afterRedo)).toBe(true);
    expect(canRedo(afterRedo)).toBe(false);
  });
});
