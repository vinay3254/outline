import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../state/editor-store';
import { getClipTimelineEnd, snapFrame, TrimEdge } from '../domain/timeline';
import { Clip } from '../domain/project';

interface DragMoveDraft {
  type: 'move';
  clipId: string;
  trackId: string;
  startFrame: number;
}

interface DragTrimDraft {
  type: 'trim';
  clipId: string;
  edge: 'start' | 'end';
  frame: number;
}

type DraftState = DragMoveDraft | DragTrimDraft | null;

export const Timeline: React.FC = () => {
  const {
    project,
    selectedClipId,
    playheadFrame,
    timelineZoom,
    isPlaying,
    selectClip,
    setPlayheadFrame,
    stepFrame,
    setIsPlaying,
    setTimelineZoom,
    splitAtPlayhead,
    deleteSelectedClip,
    undo,
    redo,
    moveClipTo,
    trimClipEdge,
    addClipFromAsset,
  } = useEditorStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<DraftState>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (draft) {
          e.preventDefault();
          setDraft(null);
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isCmdOrCtrl && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
        return;
      }

      if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') {
        e.preventDefault();
        splitAtPlayhead();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          deleteSelectedClip();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(-1);
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(1);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    draft,
    selectedClipId,
    setIsPlaying,
    splitAtPlayhead,
    deleteSelectedClip,
    stepFrame,
    undo,
    redo,
  ]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || true) {
      // Zoom on timeline wheel
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setTimelineZoom((prev) => prev * factor);
    }
  };

  // Timeline coordinate helpers
  const getFrameFromClientX = useCallback(
    (clientX: number): number => {
      if (!tracksContainerRef.current) return 0;
      const rect = tracksContainerRef.current.getBoundingClientRect();
      const scrollLeft = tracksContainerRef.current.scrollLeft || 0;
      const offsetX = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.round(offsetX / timelineZoom));
    },
    [timelineZoom]
  );

  // Ruler scrubbing
  const handleRulerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    setIsScrubbing(true);
    const frame = getFrameFromClientX(e.clientX);
    setPlayheadFrame(frame);
  };

  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (isScrubbing) {
      const frame = getFrameFromClientX(e.clientX);
      setPlayheadFrame(frame);
    }
  };

  const handleRulerPointerUp = (e: React.PointerEvent) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Pointer drag for moving clip
  const startClipMove = (e: React.PointerEvent, clip: Clip) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialStartFrame = clip.timelineStartFrame;
    const duration = clip.sourceOutFrame - clip.sourceInFrame;
    const targetElement = e.currentTarget as HTMLElement;
    try {
      targetElement.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    // Compute snap targets: playhead, other clips starts and ends
    const snapTargets = [
      0,
      playheadFrame,
      ...project.clips
        .filter((c) => c.id !== clip.id)
        .flatMap((c) => [c.timelineStartFrame, getClipTimelineEnd(c)]),
    ];

    let currentDraft: DragMoveDraft = {
      type: 'move',
      clipId: clip.id,
      trackId: clip.trackId,
      startFrame: initialStartFrame,
    };

    setDraft(currentDraft);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaPixels = moveEvent.clientX - startX;
      const deltaFrames = Math.round(deltaPixels / timelineZoom);
      let newStart = Math.max(0, initialStartFrame + deltaFrames);

      // Snap start or end
      const snappedStart = snapFrame(newStart, snapTargets, Math.round(10 / timelineZoom));
      const snappedEnd = snapFrame(newStart + duration, snapTargets, Math.round(10 / timelineZoom));
      if (Math.abs(snappedStart - newStart) < Math.abs(snappedEnd - (newStart + duration))) {
        newStart = snappedStart;
      } else if (Math.abs(snappedEnd - (newStart + duration)) <= Math.round(10 / timelineZoom)) {
        newStart = Math.max(0, snappedEnd - duration);
      }

      currentDraft = {
        type: 'move',
        clipId: clip.id,
        trackId: clip.trackId,
        startFrame: newStart,
      };
      setDraft(currentDraft);
    };

    const onPointerUp = () => {
      targetElement.removeEventListener('pointermove', onPointerMove);
      targetElement.removeEventListener('pointerup', onPointerUp);
      try {
        targetElement.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (currentDraft && currentDraft.startFrame !== initialStartFrame) {
        moveClipTo(currentDraft.clipId, currentDraft.trackId, currentDraft.startFrame);
      }
      setDraft(null);
    };

    targetElement.addEventListener('pointermove', onPointerMove);
    targetElement.addEventListener('pointerup', onPointerUp);
  };

  // Pointer drag for trimming clip
  const startClipTrim = (
    e: React.PointerEvent,
    clip: Clip,
    edge: 'start' | 'end'
  ) => {
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialFrame = edge === 'start' ? clip.timelineStartFrame : getClipTimelineEnd(clip);
    const targetElement = e.currentTarget as HTMLElement;
    try {
      targetElement.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    const snapTargets = [
      0,
      playheadFrame,
      ...project.clips
        .filter((c) => c.id !== clip.id)
        .flatMap((c) => [c.timelineStartFrame, getClipTimelineEnd(c)]),
    ];

    let currentDraft: DragTrimDraft = {
      type: 'trim',
      clipId: clip.id,
      edge,
      frame: initialFrame,
    };
    setDraft(currentDraft);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaPixels = moveEvent.clientX - startX;
      const deltaFrames = Math.round(deltaPixels / timelineZoom);
      let targetF = initialFrame + deltaFrames;

      targetF = snapFrame(targetF, snapTargets, Math.round(8 / timelineZoom));

      if (edge === 'start') {
        const clipEnd = getClipTimelineEnd(clip);
        targetF = Math.max(0, Math.min(clipEnd - 1, targetF));
      } else {
        targetF = Math.max(clip.timelineStartFrame + 1, targetF);
      }

      currentDraft = {
        type: 'trim',
        clipId: clip.id,
        edge,
        frame: targetF,
      };
      setDraft(currentDraft);
    };

    const onPointerUp = () => {
      targetElement.removeEventListener('pointermove', onPointerMove);
      targetElement.removeEventListener('pointerup', onPointerUp);
      try {
        targetElement.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }

      if (currentDraft && currentDraft.frame !== initialFrame) {
        trimClipEdge(currentDraft.clipId, currentDraft.edge as TrimEdge, currentDraft.frame);
      }
      setDraft(null);
    };

    targetElement.addEventListener('pointermove', onPointerMove);
    targetElement.addEventListener('pointerup', onPointerUp);
  };

  // Drop target on track
  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.type === 'asset' && data.assetId) {
        const clipsOnTrack = project.clips.filter((c) => c.trackId === trackId);
        const dropFrame = clipsOnTrack.length === 0 ? 0 : getFrameFromClientX(e.clientX);
        addClipFromAsset(data.assetId, trackId, dropFrame);
      }
    } catch {
      // ignore
    }
  };

  // Calculate timeline max duration
  const maxClipEnd = project.clips.reduce(
    (max, c) => Math.max(max, getClipTimelineEnd(c)),
    0
  );
  const totalFrames = Math.max(300, maxClipEnd + 150, playheadFrame + 60);
  const timelineWidth = totalFrames * timelineZoom;

  return (
    <div
      ref={containerRef}
      className="timeline-container"
      onWheel={handleWheel}
      aria-label="Timeline"
    >
      {/* Header with track labels & ruler */}
      <div className="timeline-header-row">
        <div className="track-headers-column">
          <span className="tracks-label">Tracks</span>
        </div>

        {/* Ruler */}
        <div
          className="timeline-ruler"
          style={{ width: `${timelineWidth}px` }}
          onPointerDown={handleRulerPointerDown}
          onPointerMove={handleRulerPointerMove}
          onPointerUp={handleRulerPointerUp}
          role="slider"
          aria-label="Timeline ruler"
          aria-valuenow={playheadFrame}
        >
          {Array.from({ length: Math.ceil(totalFrames / project.frameRate) + 1 }).map((_, sec) => {
            const frame = sec * project.frameRate;
            return (
              <div
                key={sec}
                className="ruler-mark"
                style={{ left: `${frame * timelineZoom}px` }}
              >
                <span className="ruler-time">{sec}s</span>
                <div className="ruler-tick" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracks and Playhead container */}
      <div className="timeline-body">
        <div className="track-headers-column">
          {project.tracks.map((track) => (
            <div key={track.id} className="track-header">
              <span className="track-name">{track.name}</span>
              <span className="track-type">{track.type}</span>
            </div>
          ))}
        </div>

        <div
          ref={tracksContainerRef}
          className="tracks-scroll-area"
          style={{ width: `${timelineWidth}px` }}
          onClick={(e) => {
            // Click outside clips deselects
            if (e.target === e.currentTarget) {
              selectClip(null);
            }
          }}
        >
          {/* Playhead line */}
          <div
            className="timeline-playhead"
            style={{ left: `${playheadFrame * timelineZoom}px` }}
            aria-label="Playhead"
          >
            <div className="playhead-handle" />
            <div className="playhead-line" />
          </div>

          {/* Tracks list */}
          {project.tracks.map((track) => (
            <div
              key={track.id}
              data-testid={`track-${track.id}`}
              className="timeline-track"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => handleTrackDrop(e, track.id)}
            >
              {project.clips
                .filter((clip) => clip.trackId === track.id)
                .map((clip) => {
                  let startFrame = clip.timelineStartFrame;
                  let endFrame = getClipTimelineEnd(clip);

                  // Apply draft override if this clip is being dragged
                  if (draft && draft.clipId === clip.id) {
                    if (draft.type === 'move') {
                      const dur = clip.sourceOutFrame - clip.sourceInFrame;
                      startFrame = draft.startFrame;
                      endFrame = draft.startFrame + dur;
                    } else if (draft.type === 'trim') {
                      if (draft.edge === 'start') {
                        startFrame = draft.frame;
                      } else {
                        endFrame = draft.frame;
                      }
                    }
                  }

                  const duration = Math.max(1, endFrame - startFrame);
                  const clipLeft = startFrame * timelineZoom;
                  const clipWidth = Math.max(8, duration * timelineZoom);
                  const isSelected = selectedClipId === clip.id;
                  const asset = project.assets.find((a) => a.id === clip.assetId);

                  return (
                    <div
                      key={clip.id}
                      data-testid="timeline-clip"
                      className={`timeline-clip ${clip.trackId.startsWith('a') ? 'audio' : 'video'} ${
                        isSelected ? 'selected' : ''
                      } ${clip.status === 'offline' ? 'offline' : ''}`}
                      style={{
                        left: `${clipLeft}px`,
                        width: `${clipWidth}px`,
                      }}
                      onPointerDown={(e) => startClipMove(e, clip)}
                    >
                      {/* Left trim handle */}
                      <div
                        className="trim-handle trim-handle-start"
                        aria-label="Trim start handle"
                        onPointerDown={(e) => startClipTrim(e, clip, 'start')}
                      />

                      {/* Clip label */}
                      <div className="clip-content">
                        <span className="clip-title">
                          {asset ? asset.name : 'Clip'}
                        </span>
                        {clip.effect !== 'none' && (
                          <span className="clip-effect-tag">{clip.effect}</span>
                        )}
                        {clip.status === 'offline' && (
                          <span className="clip-offline-tag">OFFLINE</span>
                        )}
                      </div>

                      {/* Right trim handle */}
                      <div
                        className="trim-handle trim-handle-end"
                        aria-label="Trim end handle"
                        onPointerDown={(e) => startClipTrim(e, clip, 'end')}
                      />
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
