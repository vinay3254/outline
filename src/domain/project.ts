export type FilterType = 'none' | 'monochrome' | 'warmContrast';

export interface ClipEffect {
  type: FilterType;
  intensity?: number;
}

export interface Asset {
  id: string;
  name: string;
  mimeType: string;
  durationInSeconds: number;
  durationInFrames: number;
  width: number;
  height: number;
}

export type TrackType = 'video' | 'audio';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  timelineStartFrame: number;
  sourceInFrame: number;
  sourceOutFrame: number;
  opacity: number;
  volume: number;
  muted: boolean;
  effect: FilterType;
  status?: 'online' | 'offline';
}

export interface Project {
  id: string;
  name: string;
  frameRate: number;
  tracks: Track[];
  clips: Clip[];
  assets: Asset[];
}

export function frameToSeconds(frame: number, frameRate: number): number {
  return frame / frameRate;
}

export function secondsToFrame(seconds: number, frameRate: number): number {
  return Math.round(seconds * frameRate);
}

export function formatTimecode(frame: number, frameRate: number): string {
  const nonNegativeFrame = Math.max(0, Math.round(frame));
  const framesPerSecond = Math.max(1, Math.round(frameRate));
  
  const f = nonNegativeFrame % framesPerSecond;
  const totalSeconds = Math.floor(nonNegativeFrame / framesPerSecond);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function createProject(name: string, frameRate = 30): Project {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id,
    name,
    frameRate,
    tracks: [
      { id: 'v1', name: 'Video 1', type: 'video' },
      { id: 'a1', name: 'Audio 1', type: 'audio' },
    ],
    clips: [],
    assets: [],
  };
}
