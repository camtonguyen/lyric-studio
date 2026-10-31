/** WebGL: draws the editor surface as a 3D plane with depth-of-field + motion blur. */
import { LINE_H, TOP } from "./constants";

const VERTEX = `#version 300 es
in vec2 aPos; uniform mat4 uM; uniform vec2 uSize; out vec2 vUV;
void main(){ vUV = aPos / uSize; gl_Position = uM * vec4(aPos, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uFocus, uDof, uZoom, uMotion, uAlpha, uTop, uLH;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float line = (vUV.y * uSize.y - uTop) / uLH - 0.5;
  float d = max(0.0, abs(line - uFocus) - 0.45);
  float r = min(10.0, uDof * 0.6 * uZoom * pow(d, 1.15)) + uMotion;   // blur in screen px
  float rt = r / max(uZoom, 0.15);                                   // ...in surface px
  vec4 c = texture(uTex, vUV);
  if (rt > 0.35) {
    vec4 acc = vec4(0.0);
    float a0 = hash(gl_FragCoord.xy) * 6.2831;
    for (int k = 0; k < 24; k++) {
      float fk = float(k);
      float rr = sqrt((fk + 0.5) / 24.0) * rt;
      float an = a0 + fk * 2.39996;
      acc += texture(uTex, vUV + vec2(cos(an), sin(an)) * rr / uSize);
    }
    c = acc / 24.0;
  }
  o = vec4(c.rgb, uAlpha);
}`;

export interface PlaneUniforms { focusLine: number; dof: number; zoom: number; motion: number; alpha: number }

export class Plane {
  readonly canvas = document.createElement("canvas");
  private gl: WebGL2RenderingContext;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private size = [0, 0];
  /** surface pixels → texture pixels */
  texScale = 1.5;

  constructor() {
    const gl = this.canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);
    for (const n of ["uM", "uSize", "uTex", "uFocus", "uDof", "uZoom", "uMotion", "uAlpha", "uTop", "uLH"]) this.u[n] = gl.getUniformLocation(prog, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  setOutputSize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /** (Re)allocate the surface texture. Picks the sharpest scale the GPU allows. */
  allocate(width: number, height: number) {
    const gl = this.gl;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    for (const s of [2, 1.75, 1.5, 1.25, 1]) {
      this.texScale = s;
      if (height * s <= max && width * s <= max && width * s * height * s * 4 <= 140e6) break;
    }
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, Math.round(width * this.texScale), Math.round(height * this.texScale));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, width, 0, 0, height, width, height]), gl.STATIC_DRAW);
    this.size = [width, height];
  }

  /** Upload a horizontal strip of the surface at surface-y `y`. */
  upload(y: number, strip: HTMLCanvasElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, Math.round(y * this.texScale), gl.RGBA, gl.UNSIGNED_BYTE, strip);
  }

  draw(matrix: Float32Array, u: PlaneUniforms) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniformMatrix4fv(this.u.uM, false, matrix);
    gl.uniform2f(this.u.uSize, this.size[0], this.size[1]);
    gl.uniform1i(this.u.uTex, 0);
    gl.uniform1f(this.u.uFocus, u.focusLine);
    gl.uniform1f(this.u.uDof, u.dof);
    gl.uniform1f(this.u.uZoom, u.zoom);
    gl.uniform1f(this.u.uMotion, u.motion);
    gl.uniform1f(this.u.uAlpha, u.alpha);
    gl.uniform1f(this.u.uTop, TOP);
    gl.uniform1f(this.u.uLH, LINE_H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
