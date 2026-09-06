import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEditorStore } from '../state/editor-store';
import { ExportButton } from './ExportButton';
import { ExportAdapter, ExportRequest } from '../export/export-adapter';

class MockSuccessAdapter implements ExportAdapter {
  async export(request: ExportRequest): Promise<Blob> {
    request.onProgress?.({ phase: 'encoding', fraction: 0.5 });
    request.onProgress?.({ phase: 'encoding', fraction: 1 });
    return new Blob(['fake-video-bytes'], { type: 'video/mp4' });
  }
}

class MockFailingAdapter implements ExportAdapter {
  async export(): Promise<Blob> {
    throw new Error('EXPORT_FAILED: Virtual memory exhausted');
  }
}

describe('ExportButton component', () => {
  beforeEach(() => {
    const store = useEditorStore.getState();
    const project = {
      id: 'test-p',
      name: 'Export Test',
      frameRate: 30,
      tracks: [{ id: 'v1', name: 'Video 1', type: 'video' as const }],
      assets: [
        {
          id: 'asset-1',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          durationInSeconds: 2,
          durationInFrames: 60,
          width: 1920,
          height: 1080,
        },
      ],
      clips: [],
    };
    store.setProject(project);
    store.setNotice(null);
  });

  it('is disabled when there are no clips', () => {
    render(<ExportButton />);
    const exportBtn = screen.getByRole('button', { name: 'Export' });
    expect(exportBtn).toBeDisabled();
  });

  it('enables when clips exist, exports successfully and initiates download', async () => {
    const user = userEvent.setup();
    const store = useEditorStore.getState();
    store.addAssetWithClip(
      {
        id: 'asset-1',
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        durationInSeconds: 2,
        durationInFrames: 60,
        width: 1920,
        height: 1080,
      },
      'blob:asset-1'
    );

    const mockAdapter = new MockSuccessAdapter();
    render(<ExportButton adapter={mockAdapter} />);

    const exportBtn = screen.getByRole('button', { name: 'Export' });
    expect(exportBtn).toBeEnabled();

    // Mock URL.createObjectURL
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:export-url');
    URL.revokeObjectURL = vi.fn();

    await user.click(exportBtn);

    await waitFor(() => {
      expect(useEditorStore.getState().notice?.type).toBe('info');
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it('handles export failures gracefully with a recoverable notice', async () => {
    const user = userEvent.setup();
    const store = useEditorStore.getState();
    store.addAssetWithClip(
      {
        id: 'asset-1',
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        durationInSeconds: 2,
        durationInFrames: 60,
        width: 1920,
        height: 1080,
      },
      'blob:asset-1'
    );

    const mockFailing = new MockFailingAdapter();
    render(<ExportButton adapter={mockFailing} />);

    await user.click(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(useEditorStore.getState().notice?.message).toContain('EXPORT_FAILED');
      expect(useEditorStore.getState().notice?.type).toBe('error');
    });
  });
});
