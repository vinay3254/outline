import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject } from '../domain/project';
import { PreviewEngine } from './preview-engine';

describe('PreviewEngine', () => {
  let mockVideo: HTMLVideoElement;
  let mockCanvas: HTMLCanvasElement;
  let draw: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    draw = vi.fn();
    mockVideo = {
      src: '',
      currentTime: 0,
      volume: 1,
      muted: false,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    } as unknown as HTMLVideoElement;

    mockCanvas = {
      getContext: vi.fn(() => null),
      width: 1920,
      height: 1080,
    } as unknown as HTMLCanvasElement;
  });

  it('seeks video to exact source seconds and triggers draw with clip effect', () => {
    const project = createProject('Test Preview', 30);
    project.assets.push({
      id: 'asset-1',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      durationInSeconds: 5,
      durationInFrames: 150,
      width: 1920,
      height: 1080,
    });
    project.clips.push({
      id: 'clip-1',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 0,
      sourceInFrame: 0,
      sourceOutFrame: 100,
      opacity: 0.8,
      volume: 1,
      muted: false,
      effect: 'monochrome',
    });

    const engine = new PreviewEngine(mockVideo, mockCanvas, { onDraw: draw });
    const assetUrls = { 'asset-1': 'blob:asset-1-url' };

    engine.seek(45, project, assetUrls);

    expect(mockVideo.currentTime).toBeCloseTo(1.5);
    expect(draw).toHaveBeenCalledWith(expect.objectContaining({ effect: 'monochrome' }));
  });
});
