import { Asset, secondsToFrame } from '../domain/project';

const SUPPORTED_MIME_TYPES = new Set(['video/mp4', 'video/webm']);

export function isSupportedMedia(file: File): boolean {
  if (file.type && SUPPORTED_MIME_TYPES.has(file.type)) {
    return true;
  }
  const ext = file.name.toLowerCase().split('.').pop();
  return ext === 'mp4' || ext === 'webm';
}

export interface ImportAssetResult {
  asset: Asset;
  objectUrl: string;
}

export function importAsset(file: File, frameRate = 30): Promise<ImportAssetResult> {
  return new Promise((resolve, reject) => {
    if (!isSupportedMedia(file)) {
      return reject(new Error('UNSUPPORTED_MEDIA: Cutline only supports MP4 and WebM videos.'));
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = objectUrl;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    const onLoaded = () => {
      cleanup();
      const duration = video.duration || 0;
      const durationInFrames = Math.max(1, secondsToFrame(duration, frameRate));
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;

      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const asset: Asset = {
        id,
        name: file.name,
        mimeType: file.type || (file.name.endsWith('.webm') ? 'video/webm' : 'video/mp4'),
        durationInSeconds: duration,
        durationInFrames,
        width,
        height,
      };

      resolve({ asset, objectUrl });
    };

    const onError = () => {
      cleanup();
      URL.revokeObjectURL(objectUrl);
      reject(new Error('FAILED_TO_DECODE: Unable to decode video file.'));
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}
