import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importAsset } from './import-assets';

describe('Media asset import', () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('imports valid MP4 file and probes metadata', async () => {
    // Mock HTMLVideoElement behavior
    const mockVideo = {
      preload: '',
      src: '',
      duration: 5.5,
      videoWidth: 1920,
      videoHeight: 1080,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'loadedmetadata') {
          setTimeout(callback, 0);
        }
      }),
      removeEventListener: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') return mockVideo as unknown as HTMLVideoElement;
      return document.createElement(tagName);
    });

    const file = new File(['video-content'], 'clip.mp4', { type: 'video/mp4' });
    const result = await importAsset(file, 30);

    expect(result.asset).toMatchObject({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      durationInSeconds: 5.5,
      durationInFrames: 165,
      width: 1920,
      height: 1080,
    });
    expect(result.objectUrl).toBe('blob:mock-url');
  });

  it('rejects unsupported media formats', async () => {
    const file = new File(['x'], 'clip.mov', { type: 'video/quicktime' });
    await expect(importAsset(file)).rejects.toThrow('UNSUPPORTED_MEDIA');
  });
});
