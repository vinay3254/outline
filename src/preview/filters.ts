import { FilterType } from '../domain/project';

export const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // Invert Y coordinate for video texture coordinates
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}
`;

export const FRAGMENT_SHADERS: Record<FilterType, string> = {
  none: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_opacity;

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      gl_FragColor = vec4(color.rgb, color.a * u_opacity);
    }
  `,

  monochrome: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_opacity;

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      gl_FragColor = vec4(vec3(gray), color.a * u_opacity);
    }
  `,

  warmContrast: `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_image;
    uniform float u_opacity;

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      // Contrast boost
      vec3 contrast = clamp((color.rgb - 0.5) * 1.25 + 0.5, 0.0, 1.0);
      // Warm tint: boost red, subtle blue drop
      vec3 warm = clamp(contrast * vec3(1.15, 1.02, 0.88), 0.0, 1.0);
      gl_FragColor = vec4(warm, color.a * u_opacity);
    }
  `,
};

export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function getFilterProgram(
  gl: WebGLRenderingContext,
  effect: FilterType
): WebGLProgram | null {
  const vShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADERS[effect]);
  if (!vShader || !fShader) return null;
  return createProgram(gl, vShader, fShader);
}
