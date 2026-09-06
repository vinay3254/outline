import { Project, Asset, FilterType } from '../domain/project';
import { getClipTimelineEnd } from '../domain/timeline';

export interface RenderSegment {
  clipId: string;
  assetId: string;
  timelineStartFrame: number;
  timelineEndFrame: number;
  sourceInFrame: number;
  sourceOutFrame: number;
  effect: FilterType;
  opacity: number;
  volume: number;
  muted: boolean;
}

export interface RenderSequence {
  frameRate: number;
  totalDurationFrames: number;
  segments: RenderSegment[];
}

export interface ExportProgress {
  phase: 'preparing' | 'encoding' | 'finalizing';
  fraction: number; // 0 to 1
}

export interface ExportRequest {
  sequence: RenderSequence;
  assets: Asset[];
  assetUrls?: Record<string, string>;
  outputFormat?: 'mp4' | 'webm';
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportAdapter {
  export(request: ExportRequest): Promise<Blob>;
}

export function buildRenderSequence(project: Project): RenderSequence {
  // Resolve clips from video tracks, sorted by timelineStartFrame
  const videoTracks = new Set(project.tracks.filter((t) => t.type === 'video').map((t) => t.id));
  
  const videoClips = project.clips
    .filter((clip) => videoTracks.has(clip.trackId))
    .sort((a, b) => a.timelineStartFrame - b.timelineStartFrame);

  const segments: RenderSegment[] = videoClips.map((clip) => {
    const endFrame = getClipTimelineEnd(clip);
    return {
      clipId: clip.id,
      assetId: clip.assetId,
      timelineStartFrame: clip.timelineStartFrame,
      timelineEndFrame: endFrame,
      sourceInFrame: clip.sourceInFrame,
      sourceOutFrame: clip.sourceOutFrame,
      effect: clip.effect,
      opacity: clip.opacity,
      volume: clip.volume,
      muted: clip.muted,
    };
  });

  const totalDurationFrames = segments.reduce(
    (max, seg) => Math.max(max, seg.timelineEndFrame),
    0
  );

  return {
    frameRate: project.frameRate,
    totalDurationFrames,
    segments,
  };
}
