import { Project, FilterType, frameToSeconds } from '../domain/project';
import { resolveActiveClip } from '../domain/timeline';
import { getFilterProgram } from './filters';

export interface DrawInfo {
  effect: FilterType;
  opacity: number;
}

export interface PreviewEngineOptions {
  onDraw?: (info: DrawInfo) => void;
  onFrameAdvance?: (nextFrame: number) => void;
}

export class PreviewEngine {
  private gl: WebGLRenderingContext | null = null;
  private programs: Map<FilterType, WebGLProgram> = new Map();
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private currentAssetId: string | null = null;

  constructor(
    public videoElement: HTMLVideoElement,
    public canvasElement: HTMLCanvasElement,
    private options?: PreviewEngineOptions
  ) {
    this.initWebGL();
  }

  private initWebGL(): void {
    try {
      this.gl =
        this.canvasElement.getContext('webgl') ||
        (this.canvasElement.getContext('experimental-webgl') as WebGLRenderingContext | null);

      if (!this.gl) return;

      const gl = this.gl;
      // Setup quad positions: 2 triangles covering [-1, 1]
      const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]);
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      // Setup texture coordinates covering [0, 1]
      const texCoords = new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        0, 1,
        1, 0,
        1, 1,
      ]);
      this.texCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

      // Create texture
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } catch {
      // WebGL might be unavailable in some environments (e.g., headless jsdom)
      this.gl = null;
    }
  }

  private getProgram(effect: FilterType): WebGLProgram | null {
    if (!this.gl) return null;
    if (this.programs.has(effect)) {
      return this.programs.get(effect)!;
    }
    const prog = getFilterProgram(this.gl, effect);
    if (prog) {
      this.programs.set(effect, prog);
    }
    return prog;
  }

  public renderWebGL(effect: FilterType, opacity: number): void {
    if (!this.gl) return;
    const gl = this.gl;
    const program = this.getProgram(effect);
    if (!program) return;

    gl.viewport(0, 0, this.canvasElement.width, this.canvasElement.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Upload video frame to texture
    if (this.videoElement.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.videoElement
      );
    }

    // Attributes
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const opacityLoc = gl.getUniformLocation(program, 'u_opacity');
    gl.uniform1f(opacityLoc, opacity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public seek(
    frame: number,
    project: Project,
    assetUrls: Record<string, string>
  ): void {
    const activeClip = resolveActiveClip(project, frame);

    if (!activeClip) {
      this.clearCanvas();
      if (!this.videoElement.paused) {
        this.videoElement.pause();
      }
      return;
    }

    const offset = frame - activeClip.timelineStartFrame;
    const sourceFrame = activeClip.sourceInFrame + offset;
    const sourceSeconds = frameToSeconds(sourceFrame, project.frameRate);

    const url = assetUrls[activeClip.assetId];
    if (url && this.currentAssetId !== activeClip.assetId) {
      this.currentAssetId = activeClip.assetId;
      this.videoElement.src = url;
    }

    this.videoElement.currentTime = sourceSeconds;
    this.videoElement.volume = activeClip.muted ? 0 : activeClip.volume;
    this.videoElement.muted = activeClip.muted;

    const drawInfo: DrawInfo = {
      effect: activeClip.effect,
      opacity: activeClip.opacity,
    };

    this.renderWebGL(drawInfo.effect, drawInfo.opacity);
    this.options?.onDraw?.(drawInfo);
  }

  public clearCanvas(): void {
    if (this.gl) {
      this.gl.clearColor(0, 0, 0, 1);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else {
      const ctx = this.canvasElement.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.canvasElement.width, this.canvasElement.height);
      }
    }
  }

  public play(): Promise<void> {
    return this.videoElement.play();
  }

  public pause(): void {
    this.videoElement.pause();
  }
}
