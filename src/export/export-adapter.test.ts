import { describe, it, expect, vi } from 'vitest';
import { createProject } from '../domain/project';
import {
  buildRenderSequence,
  ExportAdapter,
  ExportRequest,
} from './export-adapter';

class MockExportAdapter implements ExportAdapter {
  async export(request: ExportRequest): Promise<Blob> {
    request.onProgress?.({ phase: 'preparing', fraction: 0 });
    request.onProgress?.({ phase: 'encoding', fraction: 0.5 });
    request.onProgress?.({ phase: 'encoding', fraction: 1 });
    return new Blob(['mock-video'], { type: 'video/mp4' });
  }
}

describe('Export boundary & render sequence', () => {
  it('builds a frame-accurate render sequence from project clips', () => {
    const project = createProject('Export Test', 30);
    project.assets.push({
      id: 'asset-1',
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      durationInSeconds: 3,
      durationInFrames: 90,
      width: 1920,
      height: 1080,
    });
    project.clips.push({
      id: 'clip-1',
      assetId: 'asset-1',
      trackId: 'v1',
      timelineStartFrame: 0,
      sourceInFrame: 0,
      sourceOutFrame: 30,
      opacity: 1,
      volume: 1,
      muted: false,
      effect: 'none',
    });

    const sequence = buildRenderSequence(project);
    expect(sequence.totalDurationFrames).toBe(30);
    expect(sequence.segments[0]).toMatchObject({
      sourceInFrame: 0,
      sourceOutFrame: 30,
      timelineStartFrame: 0,
      timelineEndFrame: 30,
    });
  });

  it('reports progress through all phases and returns exported video blob', async () => {
    const project = createProject('Export Test', 30);
    const sequence = buildRenderSequence(project);
    const onProgress = vi.fn();
    const adapter = new MockExportAdapter();

    const blob = await adapter.export({
      sequence,
      assets: [],
      onProgress,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(onProgress).toHaveBeenLastCalledWith({ phase: 'encoding', fraction: 1 });
  });
});
