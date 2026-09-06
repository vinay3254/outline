import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../state/editor-store';
import { Inspector } from './Inspector';

describe('Inspector component', () => {
  beforeEach(() => {
    const store = useEditorStore.getState();
    const project = {
      id: 'test-p',
      name: 'Test Project',
      frameRate: 30,
      tracks: [{ id: 'v1', name: 'Video 1', type: 'video' as const }],
      assets: [
        {
          id: 'asset-1',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          durationInSeconds: 3,
          durationInFrames: 90,
          width: 1920,
          height: 1080,
        },
      ],
      clips: [
        {
          id: 'clip-1',
          assetId: 'asset-1',
          trackId: 'v1',
          timelineStartFrame: 0,
          sourceInFrame: 0,
          sourceOutFrame: 60,
          opacity: 1,
          volume: 1,
          muted: false,
          effect: 'none' as const,
        },
      ],
    };
    store.setProject(project);
  });

  it('remains hidden when no clip is selected', () => {
    useEditorStore.getState().selectClip(null);
    const { container } = render(<Inspector />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reveals controls when clip is selected and updates filter via history command', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().selectClip('clip-1');
    render(<Inspector />);

    const filterSelect = screen.getByLabelText('Filter');
    expect(filterSelect).toBeVisible();
    expect(filterSelect).toHaveValue('none');

    await user.selectOptions(filterSelect, 'monochrome');
    expect(useEditorStore.getState().project.clips[0].effect).toBe('monochrome');

    // Verify it is an undoable command
    expect(useEditorStore.getState().canUndo()).toBe(true);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().project.clips[0].effect).toBe('none');
  });

  it('updates opacity and mute controls', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().selectClip('clip-1');
    render(<Inspector />);

    const muteCheckbox = screen.getByLabelText('Mute');
    await user.click(muteCheckbox);
    expect(useEditorStore.getState().project.clips[0].muted).toBe(true);
  });
});
