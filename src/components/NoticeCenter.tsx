import React from 'react';
import { useEditorStore } from '../state/editor-store';

export const NoticeCenter: React.FC = () => {
  const { notice, setNotice, project, assetUrls } = useEditorStore();

  const availableIds = new Set(Object.keys(assetUrls));
  const offlineClips = project.clips.filter(
    (c) => c.status === 'offline' || !availableIds.has(c.assetId)
  );

  // Group offline clips by missing asset name
  const missingAssetNames = Array.from(
    new Set(
      offlineClips
        .map((c) => project.assets.find((a) => a.id === c.assetId)?.name)
        .filter((name): name is string => !!name)
    )
  );

  if (!notice && missingAssetNames.length === 0) {
    return null;
  }

  return (
    <div className="notice-center" role="region" aria-label="Notifications">
      {notice && (
        <div className={`notice-bar ${notice.type}`} role="alert">
          <span className="notice-text">{notice.message}</span>
          <button
            type="button"
            className="notice-close"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      {missingAssetNames.map((name) => (
        <div key={name} className="notice-bar warning" role="alert">
          <span className="notice-text">
            Re-import <strong>{name}</strong> to restore this clip.
          </span>
        </div>
      ))}
    </div>
  );
};
