import { FFmpeg } from '@ffmpeg/ffmpeg';
import { ExportAdapter, ExportRequest } from './export-adapter';
import { frameToSeconds } from '../domain/project';

export class FFmpegExportAdapter implements ExportAdapter {
  private ffmpeg: FFmpeg | null = null;

  private async loadFFmpeg(): Promise<FFmpeg> {
    if (this.ffmpeg) return this.ffmpeg;

    const ffmpeg = new FFmpeg();
    try {
      // Load standard wasm binary
      await ffmpeg.load();
      this.ffmpeg = ffmpeg;
      return ffmpeg;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`EXPORT_FAILED: Failed to load WebAssembly encoder: ${msg}`);
    }
  }

  async export(request: ExportRequest): Promise<Blob> {
    const { sequence, assetUrls = {}, onProgress } = request;

    if (sequence.segments.length === 0) {
      throw new Error('EXPORT_FAILED: No clips to export');
    }

    onProgress?.({ phase: 'preparing', fraction: 0 });

    try {
      const ffmpeg = await this.loadFFmpeg();

      onProgress?.({ phase: 'preparing', fraction: 0.2 });

      // Write each source asset to FFmpeg virtual filesystem
      const writtenAssets = new Set<string>();
      for (const segment of sequence.segments) {
        if (!writtenAssets.has(segment.assetId)) {
          const url = assetUrls[segment.assetId];
          if (!url) {
            throw new Error(`EXPORT_FAILED: Asset "${segment.assetId}" is offline or missing URL`);
          }

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`EXPORT_FAILED: Failed to fetch asset data for "${segment.assetId}"`);
          }
          const buffer = await response.arrayBuffer();
          await ffmpeg.writeFile(`input_${segment.assetId}.mp4`, new Uint8Array(buffer));
          writtenAssets.add(segment.assetId);
        }
      }

      onProgress?.({ phase: 'preparing', fraction: 0.5 });

      ffmpeg.on('progress', ({ progress }) => {
        onProgress?.({
          phase: 'encoding',
          fraction: Math.max(0, Math.min(1, progress)),
        });
      });

      // Build FFmpeg command
      const outputFilename = 'output.mp4';

      if (sequence.segments.length === 1) {
        const seg = sequence.segments[0];
        const inSec = frameToSeconds(seg.sourceInFrame, sequence.frameRate);
        const outSec = frameToSeconds(seg.sourceOutFrame, sequence.frameRate);
        const duration = outSec - inSec;

        const vfFilters: string[] = [];
        if (seg.effect === 'monochrome') {
          vfFilters.push('hue=s=0');
        } else if (seg.effect === 'warmContrast') {
          vfFilters.push('eq=contrast=1.2:saturation=1.1,colorbalance=rs=0.1:gs=0.02:bs=-0.1');
        }

        const args = [
          '-ss', inSec.toFixed(3),
          '-i', `input_${seg.assetId}.mp4`,
          '-t', duration.toFixed(3),
        ];

        if (vfFilters.length > 0) {
          args.push('-vf', vfFilters.join(','));
        }

        const afFilters: string[] = [];
        if (seg.muted) {
          afFilters.push('volume=0');
        } else if (seg.volume !== 1) {
          afFilters.push(`volume=${seg.volume.toFixed(2)}`);
        }

        if (afFilters.length > 0) {
          args.push('-af', afFilters.join(','));
        }

        args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', outputFilename);

        await ffmpeg.exec(args);
      } else {
        // Multi-segment concat using filter_complex
        const args: string[] = [];
        const filterComplex: string[] = [];

        // Add inputs
        const assetIndices = new Map<string, number>();
        let currentIdx = 0;
        for (const assetId of writtenAssets) {
          args.push('-i', `input_${assetId}.mp4`);
          assetIndices.set(assetId, currentIdx++);
        }

        // Build filter for each segment
        sequence.segments.forEach((seg, i) => {
          const inputIdx = assetIndices.get(seg.assetId) ?? 0;
          const inSec = frameToSeconds(seg.sourceInFrame, sequence.frameRate);
          const outSec = frameToSeconds(seg.sourceOutFrame, sequence.frameRate);

          let vFilter = `[${inputIdx}:v]trim=start=${inSec.toFixed(3)}:end=${outSec.toFixed(3)},setpts=PTS-STARTPTS`;
          if (seg.effect === 'monochrome') {
            vFilter += ',hue=s=0';
          } else if (seg.effect === 'warmContrast') {
            vFilter += ',eq=contrast=1.2:saturation=1.1,colorbalance=rs=0.1:gs=0.02:bs=-0.1';
          }
          vFilter += `[v${i}]`;
          filterComplex.push(vFilter);

          let aFilter = `[${inputIdx}:a]atrim=start=${inSec.toFixed(3)}:end=${outSec.toFixed(3)},asetpts=PTS-STARTPTS`;
          if (seg.muted) {
            aFilter += ',volume=0';
          } else if (seg.volume !== 1) {
            aFilter += `,volume=${seg.volume.toFixed(2)}`;
          }
          aFilter += `[a${i}]`;
          filterComplex.push(aFilter);
        });

        const concatInputs = sequence.segments.map((_, i) => `[v${i}][a${i}]`).join('');
        filterComplex.push(`${concatInputs}concat=n=${sequence.segments.length}:v=1:a=1[outv][outa]`);

        args.push(
          '-filter_complex', filterComplex.join(';'),
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p',
          '-preset', 'ultrafast',
          outputFilename
        );

        await ffmpeg.exec(args);
      }

      onProgress?.({ phase: 'finalizing', fraction: 0.95 });

      const data = await ffmpeg.readFile(outputFilename);
      onProgress?.({ phase: 'encoding', fraction: 1 });

      // Clean up files in virtual fs
      try {
        await ffmpeg.deleteFile(outputFilename);
        for (const assetId of writtenAssets) {
          await ffmpeg.deleteFile(`input_${assetId}.mp4`);
        }
      } catch {
        // ignore cleanup errors
      }

      const binaryData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      return new Blob([new Uint8Array(binaryData)], { type: 'video/mp4' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith('EXPORT_FAILED')) {
        throw err;
      }
      throw new Error(`EXPORT_FAILED: Encoding error: ${msg}`);
    }
  }
}
