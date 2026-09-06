import React, { useRef } from 'react';
import { useEditorStore } from '../state/editor-store';
import { importAsset } from '../media/import-assets';

export const MediaRail: React.FC = () => {
  const { project, addAsset, addClipFromAsset, setNotice } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { asset, objectUrl } = await importAsset(file, project.frameRate);
        addAsset(asset, objectUrl);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to import media';
        setNotice({ message, type: 'error' });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragStart = (e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'asset', assetId }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <aside className="media-rail" aria-label="Media rail">
      <div className="media-rail-header">
        <h2>Media</h2>
        <label className="import-btn" htmlFor="media-file-input">
          Import media
          <input
            id="media-file-input"
            ref={fileInputRef}
            type="file"
            aria-label="Import media"
            accept="video/mp4,video/webm"
            multiple
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="media-list" role="list">
        {project.assets.length === 0 ? (
          <div className="media-empty">No media imported yet. Click "Import media" or drag MP4/WebM files here.</div>
        ) : (
          project.assets.map((asset) => (
            <div
              key={asset.id}
              role="listitem"
              data-testid="media-asset"
              className="media-card"
              draggable
              onDragStart={(e) => handleDragStart(e, asset.id)}
              onDoubleClick={() => addClipFromAsset(asset.id)}
              title="Drag onto timeline track, or double-click to add"
            >
              <div className="media-thumbnail">
                <span className="media-badge">{asset.mimeType.split('/')[1]?.toUpperCase()}</span>
              </div>
              <div className="media-info">
                <div className="media-title" title={asset.name}>{asset.name}</div>
                <div className="media-meta">
                  {asset.width}x{asset.height} &bull; {asset.durationInSeconds.toFixed(1)}s
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
