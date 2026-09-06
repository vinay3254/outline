import React from 'react';
import { useEditorStore } from '../state/editor-store';
import { FilterType } from '../domain/project';

export const Inspector: React.FC = () => {
  const { project, selectedClipId, updateClipProps } = useEditorStore();

  if (!selectedClipId) return null;

  const clip = project.clips.find((c) => c.id === selectedClipId);
  if (!clip) return null;

  const asset = project.assets.find((a) => a.id === clip.assetId);

  return (
    <aside className="inspector-panel" aria-label="Clip inspector">
      <div className="inspector-header">Clip Inspector</div>

      <div className="inspector-group">
        <label className="inspector-label" htmlFor="filter-select">
          Filter
        </label>
        <select
          id="filter-select"
          aria-label="Filter"
          className="inspector-select"
          value={clip.effect}
          onChange={(e) =>
            updateClipProps(clip.id, { effect: e.target.value as FilterType })
          }
        >
          <option value="none">None</option>
          <option value="monochrome">Monochrome</option>
          <option value="warmContrast">Warm Contrast</option>
        </select>
      </div>

      <div className="inspector-group">
        <label className="inspector-label" htmlFor="opacity-slider">
          Opacity ({Math.round(clip.opacity * 100)}%)
        </label>
        <input
          id="opacity-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Opacity"
          className="inspector-slider"
          value={clip.opacity}
          onChange={(e) =>
            updateClipProps(clip.id, { opacity: parseFloat(e.target.value) })
          }
        />
      </div>

      <div className="inspector-group">
        <label className="inspector-label" htmlFor="volume-slider">
          Volume ({Math.round(clip.volume * 100)}%)
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Volume"
          className="inspector-slider"
          value={clip.volume}
          onChange={(e) =>
            updateClipProps(clip.id, { volume: parseFloat(e.target.value) })
          }
        />
      </div>

      <div className="inspector-group">
        <label className="inspector-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            aria-label="Mute"
            checked={clip.muted}
            onChange={(e) => updateClipProps(clip.id, { muted: e.target.checked })}
          />
          Mute Audio
        </label>
      </div>

      <div className="inspector-group" style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        <div className="inspector-label">Clip Details</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <div><strong>Source:</strong> {asset?.name || 'Unknown'}</div>
          <div><strong>Timeline Start:</strong> {clip.timelineStartFrame} frames</div>
          <div><strong>Duration:</strong> {clip.sourceOutFrame - clip.sourceInFrame} frames</div>
        </div>
      </div>
    </aside>
  );
};
