import React, { useEffect, useRef } from 'react';
import { useEditorStore } from '../state/editor-store';
import { PreviewEngine } from '../preview/preview-engine';

export const Preview: React.FC = () => {
  const {
    project,
    playheadFrame,
    isPlaying,
    timelineZoom,
    assetUrls,
    setPlayheadFrame,
    setIsPlaying,
  } = useEditorStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PreviewEngine | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);

  // Initialize engine
  useEffect(() => {
    if (videoRef.current && canvasRef.current) {
      engineRef.current = new PreviewEngine(videoRef.current, canvasRef.current);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Sync seek on playhead / project change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.seek(playheadFrame, project, assetUrls);
    }
  }, [playheadFrame, project, assetUrls, timelineZoom]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    lastTickTimeRef.current = performance.now();
    const frameDurationMs = 1000 / project.frameRate;

    const tick = (now: number) => {
      const elapsed = now - lastTickTimeRef.current;
      if (elapsed >= frameDurationMs) {
        const framesToAdvance = Math.floor(elapsed / frameDurationMs);
        lastTickTimeRef.current = now - (elapsed % frameDurationMs);

        const nextFrame = playheadFrame + framesToAdvance;
        const maxFrames = project.clips.reduce(
          (max, c) => Math.max(max, c.timelineStartFrame + (c.sourceOutFrame - c.sourceInFrame)),
          0
        );

        if (nextFrame > maxFrames && maxFrames > 0) {
          setIsPlaying(false);
          setPlayheadFrame(0);
          return;
        }

        setPlayheadFrame(nextFrame);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, playheadFrame, project.frameRate, project.clips, setIsPlaying, setPlayheadFrame]);

  return (
    <div className="preview-container" aria-label="Video preview area">
      <video ref={videoRef} playsInline preload="auto" style={{ display: 'none' }} />
      <canvas
        ref={canvasRef}
        className="preview-canvas"
        width={1280}
        height={720}
        aria-label="Preview screen"
      />
      {project.clips.length === 0 && (
        <div className="preview-placeholder">
          Import media and place clips on the timeline to preview
        </div>
      )}
    </div>
  );
};
