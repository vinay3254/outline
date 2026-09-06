import { Project, Clip } from './project';

export class TimelineError extends Error {
  constructor(public code: string, message?: string) {
    super(message ? `${code}: ${message}` : code);
    this.name = 'TimelineError';
  }
}

export function getClipTimelineEnd(clip: Clip): number {
  return clip.timelineStartFrame + (clip.sourceOutFrame - clip.sourceInFrame);
}

export function checkOverlap(
  clips: Clip[],
  trackId: string,
  startFrame: number,
  endFrame: number,
  excludeClipId?: string
): boolean {
  return clips.some((c) => {
    if (c.id === excludeClipId || c.trackId !== trackId) return false;
    const cStart = c.timelineStartFrame;
    const cEnd = getClipTimelineEnd(c);
    return Math.max(startFrame, cStart) < Math.min(endFrame, cEnd);
  });
}

export function splitClip(project: Project, clipId: string, frame: number): Project {
  const clipIndex = project.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) {
    throw new TimelineError('CLIP_NOT_FOUND', `Clip with id "${clipId}" not found`);
  }

  const clip = project.clips[clipIndex];
  const clipEnd = getClipTimelineEnd(clip);

  if (frame <= clip.timelineStartFrame || frame >= clipEnd) {
    throw new TimelineError(
      'INVALID_SPLIT',
      `Split frame ${frame} must be strictly between ${clip.timelineStartFrame} and ${clipEnd}`
    );
  }

  const offset = frame - clip.timelineStartFrame;
  const leftClip: Clip = {
    ...clip,
    sourceOutFrame: clip.sourceInFrame + offset,
  };

  const newId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${clip.id}-r-${Date.now()}`;

  const rightClip: Clip = {
    ...clip,
    id: newId,
    timelineStartFrame: frame,
    sourceInFrame: clip.sourceInFrame + offset,
    sourceOutFrame: clip.sourceOutFrame,
  };

  const newClips = [...project.clips];
  newClips.splice(clipIndex, 1, leftClip, rightClip);

  return {
    ...project,
    clips: newClips,
  };
}

export type TrimEdge = 'in' | 'out' | 'start' | 'end';

export function trimClip(
  project: Project,
  clipId: string,
  edge: TrimEdge,
  frame: number
): Project {
  const clipIndex = project.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) {
    throw new TimelineError('CLIP_NOT_FOUND', `Clip with id "${clipId}" not found`);
  }

  const clip = project.clips[clipIndex];
  const currentEnd = getClipTimelineEnd(clip);
  const asset = project.assets.find((a) => a.id === clip.assetId);

  let newTimelineStart = clip.timelineStartFrame;
  let newTimelineEnd = currentEnd;
  let newSourceIn = clip.sourceInFrame;
  let newSourceOut = clip.sourceOutFrame;

  if (edge === 'in' || edge === 'start') {
    if (frame < 0) {
      throw new TimelineError('INVALID_TRIM', 'Timeline frame cannot be negative');
    }
    if (frame >= currentEnd) {
      throw new TimelineError('INVALID_TRIM', 'Trim start cannot meet or exceed clip end');
    }

    const delta = frame - clip.timelineStartFrame;
    newSourceIn = clip.sourceInFrame + delta;

    if (newSourceIn < 0) {
      throw new TimelineError('INVALID_TRIM', 'Source in frame cannot be negative');
    }
    if (newSourceIn >= clip.sourceOutFrame) {
      throw new TimelineError('INVALID_TRIM', 'Source in frame cannot meet or exceed source out frame');
    }

    newTimelineStart = frame;
  } else if (edge === 'out' || edge === 'end') {
    if (frame <= clip.timelineStartFrame) {
      throw new TimelineError('INVALID_TRIM', 'Trim end cannot be before or at clip start');
    }

    const newDuration = frame - clip.timelineStartFrame;
    newSourceOut = clip.sourceInFrame + newDuration;

    if (asset && newSourceOut > asset.durationInFrames) {
      throw new TimelineError('INVALID_TRIM', 'Source out frame cannot exceed asset duration');
    }

    newTimelineEnd = frame;
  }

  if (checkOverlap(project.clips, clip.trackId, newTimelineStart, newTimelineEnd, clip.id)) {
    throw new TimelineError('CLIP_OVERLAP', 'CLIP_OVERLAP');
  }

  const updatedClip: Clip = {
    ...clip,
    timelineStartFrame: newTimelineStart,
    sourceInFrame: newSourceIn,
    sourceOutFrame: newSourceOut,
  };

  const newClips = [...project.clips];
  newClips[clipIndex] = updatedClip;

  return {
    ...project,
    clips: newClips,
  };
}

export function moveClip(
  project: Project,
  clipId: string,
  trackId: string,
  startFrame: number
): Project {
  const clipIndex = project.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) {
    throw new TimelineError('CLIP_NOT_FOUND', `Clip with id "${clipId}" not found`);
  }

  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new TimelineError('TRACK_NOT_FOUND', `Track with id "${trackId}" not found`);
  }

  const safeStart = Math.max(0, Math.round(startFrame));
  const clip = project.clips[clipIndex];
  const duration = clip.sourceOutFrame - clip.sourceInFrame;
  const endFrame = safeStart + duration;

  if (checkOverlap(project.clips, trackId, safeStart, endFrame, clipId)) {
    throw new TimelineError('CLIP_OVERLAP', 'CLIP_OVERLAP');
  }

  const updatedClip: Clip = {
    ...clip,
    trackId,
    timelineStartFrame: safeStart,
  };

  const newClips = [...project.clips];
  newClips[clipIndex] = updatedClip;

  return {
    ...project,
    clips: newClips,
  };
}

export function deleteClip(project: Project, clipId: string): Project {
  return {
    ...project,
    clips: project.clips.filter((c) => c.id !== clipId),
  };
}

export function addClip(project: Project, clip: Clip): Project {
  const duration = clip.sourceOutFrame - clip.sourceInFrame;
  const endFrame = clip.timelineStartFrame + duration;

  if (checkOverlap(project.clips, clip.trackId, clip.timelineStartFrame, endFrame)) {
    throw new TimelineError('CLIP_OVERLAP', 'CLIP_OVERLAP');
  }

  return {
    ...project,
    clips: [...project.clips, clip],
  };
}

export function updateClip(
  project: Project,
  clipId: string,
  updates: Partial<Omit<Clip, 'id'>>
): Project {
  const clipIndex = project.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) {
    throw new TimelineError('CLIP_NOT_FOUND', `Clip with id "${clipId}" not found`);
  }

  const currentClip = project.clips[clipIndex];
  const updatedClip: Clip = { ...currentClip, ...updates };

  const endFrame = getClipTimelineEnd(updatedClip);
  if (checkOverlap(project.clips, updatedClip.trackId, updatedClip.timelineStartFrame, endFrame, clipId)) {
    throw new TimelineError('CLIP_OVERLAP', 'CLIP_OVERLAP');
  }

  const newClips = [...project.clips];
  newClips[clipIndex] = updatedClip;

  return {
    ...project,
    clips: newClips,
  };
}

export function resolveActiveClip(project: Project, frame: number): Clip | null {
  const videoTracks = project.tracks.filter((t) => t.type === 'video');
  for (const track of videoTracks) {
    const active = project.clips.find(
      (c) =>
        c.trackId === track.id &&
        c.timelineStartFrame <= frame &&
        frame < getClipTimelineEnd(c)
    );
    if (active) return active;
  }
  return null;
}

export function snapFrame(
  targetFrame: number,
  snapTargets: number[],
  threshold = 5
): number {
  let closest = targetFrame;
  let minDiff = Infinity;

  for (const point of snapTargets) {
    const diff = Math.abs(targetFrame - point);
    if (diff <= threshold && diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}
