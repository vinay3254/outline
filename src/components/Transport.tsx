import React from 'react';
import { useEditorStore } from '../state/editor-store';
import { formatTimecode } from '../domain/project';
import {
  IconPause,
  IconPlay,
  IconRedo,
  IconScissors,
  IconStepBackward,
  IconStepForward,
  IconTrash,
  IconUndo,
} from './Icons';

export const Transport: React.FC = () => {
  const {
    project,
    playheadFrame,
    isPlaying,
    setIsPlaying,
    stepFrame,
    splitAtPlayhead,
    deleteSelectedClip,
    selectedClipId,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useEditorStore();

  return (
    <div className="transport-bar" role="toolbar" aria-label="Transport controls">
      <div className="transport-left">
        <button
          type="button"
          className="transport-btn"
          onClick={() => undo()}
          disabled={!canUndo()}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <IconUndo className="transport-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="transport-btn"
          onClick={() => redo()}
          disabled={!canRedo()}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <IconRedo className="transport-icon" aria-hidden="true" />
        </button>
        <span className="divider" />
        <button
          type="button"
          className="transport-btn"
          onClick={() => stepFrame(-1)}
          aria-label="Step frame backward"
          title="Step frame backward (Left Arrow)"
        >
          <IconStepBackward className="transport-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`transport-btn play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title="Play/Pause (Space)"
        >
          {isPlaying ? (
            <IconPause className="transport-icon" aria-hidden="true" />
          ) : (
            <IconPlay className="transport-icon" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="transport-btn"
          onClick={() => stepFrame(1)}
          aria-label="Step frame forward"
          title="Step frame forward (Right Arrow)"
        >
          <IconStepForward className="transport-icon" aria-hidden="true" />
        </button>
      </div>

      <div className="transport-center">
        <div className="timecode-display" data-testid="timecode" aria-label="Timecode">
          {formatTimecode(playheadFrame, project.frameRate)}
        </div>
        <span className="framerate-badge">{project.frameRate} fps</span>
      </div>

      <div className="transport-right">
        <button
          type="button"
          className="transport-btn"
          onClick={splitAtPlayhead}
          aria-label="Split at playhead"
          title="Split at playhead (S)"
        >
          <span className="transport-action-label">Split</span>
          <IconScissors className="transport-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="transport-btn delete-btn"
          onClick={deleteSelectedClip}
          disabled={!selectedClipId}
          aria-label="Delete clip"
          title="Delete selected clip (Delete)"
        >
          <IconTrash className="transport-icon" aria-hidden="true" />
          <span className="transport-action-label">Delete</span>
        </button>
      </div>
    </div>
  );
};
