import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../state/editor-store';
import { Timeline } from './Timeline';
import { Transport } from './Transport';

describe('Timeline component & keyboard shortcuts', () => {
  beforeEach(() => {
    const store = useEditorStore.getState();
    const project = {
      id: 'test-p',
      name: 'Test Project',
      frameRate: 30,
      tracks: [
        { id: 'v1', name: 'Video 1', type: 'video' as const },
        { id: 'a1', name: 'Audio 1', type: 'audio' as const },
      ],
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
    store.setPlayheadFrame(30);
    store.selectClip('clip-1');
  });

  it('splits at playhead on S and steps frame on ArrowRight', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Transport />
        <Timeline />
      </div>
    );

    expect(screen.getAllByTestId('timeline-clip')).toHaveLength(1);
    expect(screen.getByTestId('timecode')).toHaveTextContent('00:00:01:00');

    await user.keyboard('s');
    expect(screen.getAllByTestId('timeline-clip')).toHaveLength(2);

    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('timecode')).toHaveTextContent('00:00:01:01');
  });

  it('deletes selected clip on Delete key', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Transport />
        <Timeline />
      </div>
    );

    expect(screen.getAllByTestId('timeline-clip')).toHaveLength(1);
    await user.keyboard('{Delete}');
    expect(screen.queryByTestId('timeline-clip')).toBeNull();
  });

  it('restores complete pre-drag clip upon undo after trimming', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Transport />
        <Timeline />
      </div>
    );

    const store = useEditorStore.getState();
    expect(store.project.clips[0].sourceOutFrame).toBe(60);

    // Simulate trimming the clip's end edge to frame 45
    await user.click(screen.getByTestId('timeline-clip'));
    await user.click(screen.getByTestId('timeline-clip'));
    useEditorStore.getState().trimClipEdge('clip-1', 'end', 45);
    expect(useEditorStore.getState().project.clips[0].sourceOutFrame).toBe(45);

    // Undo via keyboard shortcut (Cmd/Ctrl-Z)
    await user.keyboard('{Control>}z{/Control}');

    // Clip restored to 60 frames
    const restored = useEditorStore.getState().project.clips[0];
    expect(restored.sourceOutFrame).toBe(60);
    expect(restored.timelineStartFrame).toBe(0);
  });
});
