import React, { useState } from 'react';
import { useEditorStore } from '../state/editor-store';
import { buildRenderSequence, ExportAdapter, ExportProgress } from '../export/export-adapter';
import { FFmpegExportAdapter } from '../export/ffmpeg-export';
import { IconExport } from './Icons';

interface ExportButtonProps {
  adapter?: ExportAdapter;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ adapter }) => {
  const { project, assetUrls, setNotice } = useEditorStore();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const handleExport = async () => {
    if (isExporting) return;

    const sequence = buildRenderSequence(project);
    if (sequence.segments.length === 0) {
      setNotice({
        message: 'No clips on timeline to export.',
        type: 'warning',
      });
      return;
    }

    setIsExporting(true);
    setProgress({ phase: 'preparing', fraction: 0 });

    try {
      const exportAdapter = adapter || new FFmpegExportAdapter();
      const blob = await exportAdapter.export({
        sequence,
        assets: project.assets,
        assetUrls,
        onProgress: (p) => setProgress(p),
      });

      // Trigger browser download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_export.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

      setNotice({
        message: 'Export completed successfully! Downloading file...',
        type: 'info',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setNotice({ message, type: 'error' });
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const hasClips = project.clips.length > 0;

  return (
    <div className="export-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {isExporting && progress && (
        <span className="export-progress" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {progress.phase === 'encoding'
            ? `Encoding: ${Math.round(progress.fraction * 100)}%`
            : `${progress.phase}...`}
        </span>
      )}
      <button
        type="button"
        className="import-btn export-btn"
        onClick={handleExport}
        disabled={!hasClips || isExporting}
        aria-label="Export"
        aria-busy={isExporting}
        title="Export project video"
      >
        <IconExport className="export-icon" aria-hidden="true" />
        <span className="export-btn-text">{isExporting ? 'Exporting...' : 'Export'}</span>
      </button>
    </div>
  );
};
