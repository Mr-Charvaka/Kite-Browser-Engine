import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_VERTEX = `#version 300 es
in vec4 a_position;
void main() {
  gl_Position = a_position;
}`;

const DEFAULT_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 outColor;

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    vec3 color = vec3(st.x, st.y, abs(sin(u_time)));
    
    // Radial pattern
    vec2 center = st - 0.5;
    float dist = length(center);
    float ring = smoothstep(0.3, 0.31, dist) - smoothstep(0.31, 0.32, dist);
    color += ring * vec3(0.0, 0.94, 1.0);
    
    // Grid lines
    vec2 grid = fract(st * 10.0);
    float line = step(0.98, grid.x) + step(0.98, grid.y);
    color += line * 0.05;

    outColor = vec4(color, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || 'Shader compile failed');
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vertShader = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vertShader || !fragShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || 'Program link failed');
  }
  return program;
}

export default function GPUPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef(performance.now());

  const [shaderCode, setShaderCode] = useState(DEFAULT_FRAGMENT);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [uTime, setUTime] = useState(0);
  const [fps, setFps] = useState(60);
  const [drawCalls, setDrawCalls] = useState<string[]>([]);
  const [compileLog, setCompileLog] = useState('OK');
  const fpsFrames = useRef<number[]>([]);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2');
    if (!gl) return;
    glRef.current = gl;

    // Create fullscreen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);

    tryCompile(DEFAULT_FRAGMENT);

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const tryCompile = useCallback((fragSource: string) => {
    const gl = glRef.current;
    if (!gl) return;
    try {
      const newProg = createProgram(gl, DEFAULT_VERTEX, fragSource);
      if (programRef.current) gl.deleteProgram(programRef.current);
      programRef.current = newProg;
      setCompileError(null);
      setCompileLog('COMPILE: OK');
      setDrawCalls([
        'Clear(COLOR | DEPTH)',
        'BindBuffer(ARRAY_BUFFER, 1)',
        `UseProgram(${(newProg as any)?.__id || 3})`,
        'DrawArrays(TRIANGLES, 0, 6)',
      ]);
      startRenderLoop();
    } catch (e: any) {
      setCompileError(e.message);
      setCompileLog(`ERROR: ${e.message}`);
    }
  }, []);

  const startRenderLoop = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    const render = () => {
      const gl = glRef.current;
      const program = programRef.current;
      const canvas = canvasRef.current;
      if (!gl || !program || !canvas) return;

      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.clearColor(0.05, 0.05, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      const t = (performance.now() - startTimeRef.current) / 1000;
      setUTime(t);

      const resLoc = gl.getUniformLocation(program, 'u_resolution');
      const timeLoc = gl.getUniformLocation(program, 'u_time');
      if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height);
      if (timeLoc) gl.uniform1f(timeLoc, t);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Track FPS
      const now = performance.now();
      fpsFrames.current.push(now);
      fpsFrames.current = fpsFrames.current.filter(f => f > now - 1000);
      setFps(fpsFrames.current.length);

      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
  }, []);

  const handleApply = () => tryCompile(shaderCode);

  const lines = shaderCode.split('\n');

  return (
    <div className="flex flex-1 overflow-hidden">
      <main className="flex-1 flex bg-surface-container-lowest overflow-hidden p-[1px] gap-[1px]">
        {/* Shader Editor — EDITABLE */}
        <section className="w-[40%] bg-surface flex flex-col border border-outline-variant min-w-[300px]">
          <div className="h-8 bg-[#111] flex items-center px-sm justify-between border-b border-outline-variant shrink-0">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">GLSL // FRAGMENT_SHADER</span>
            <button className="bg-primary text-on-primary font-label-caps text-label-caps px-2 py-1 hover:bg-primary-container transition-colors neon-glow active:scale-95" onClick={handleApply}>APPLY</button>
          </div>
          <div className="flex-1 flex bg-[#0A0A0A] font-code-sm text-code-sm overflow-hidden">
            <div className="w-8 flex flex-col items-end pr-2 py-2 text-outline-variant select-none border-r border-outline-variant bg-surface-container-low shrink-0 overflow-hidden">
              {lines.map((_, i) => <span key={i}>{i + 1}</span>)}
            </div>
            <textarea
              className="flex-1 p-2 bg-transparent text-on-surface font-code-sm text-code-sm outline-none resize-none border-none focus:ring-0 overflow-auto"
              value={shaderCode}
              onChange={e => setShaderCode(e.target.value)}
              spellCheck={false}
            />
          </div>
          {/* Compile status */}
          <div className={`h-6 px-sm flex items-center shrink-0 font-code-sm text-[10px] ${compileError ? 'bg-error/10 text-error' : 'bg-primary-container/5 text-primary-container'}`}>
            {compileLog}
          </div>
        </section>

        {/* GPU State — live uniforms */}
        <section className="w-[25%] bg-surface flex flex-col border border-outline-variant min-w-[250px] overflow-y-auto">
          <div className="flex-1 min-h-[200px] flex flex-col border-b border-outline-variant">
            <div className="h-8 bg-[#111] flex items-center px-sm border-b border-outline-variant shrink-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">UNIFORMS</span>
            </div>
            <div className="flex-1 overflow-auto bg-[#0A0A0A] p-2">
              <table className="w-full text-left font-code-sm text-code-sm border-collapse">
                <thead><tr className="text-outline-variant border-b border-outline-variant"><th className="pb-1 font-normal">NAME</th><th className="pb-1 font-normal">TYPE</th><th className="pb-1 font-normal">VALUE</th></tr></thead>
                <tbody>
                  <tr className="border-b border-outline-variant/30 hover:bg-primary-container/10 transition-colors">
                    <td className="py-1 text-on-surface">u_resolution</td>
                    <td className="py-1 text-tertiary-fixed-dim">vec2</td>
                    <td className="py-1 text-primary-fixed-dim">[{canvasRef.current?.width || 0}, {canvasRef.current?.height || 0}]</td>
                  </tr>
                  <tr className="border-b border-outline-variant/30 bg-primary-container/5 border-l-2 border-l-primary-container">
                    <td className="py-1 text-on-surface">u_time</td>
                    <td className="py-1 text-tertiary-fixed-dim">float</td>
                    <td className="py-1 text-primary-fixed-dim">{uTime.toFixed(3)} <span className="text-outline-variant animate-pulse">_</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="h-32 flex flex-col border-b border-outline-variant">
            <div className="h-8 bg-[#111] flex items-center px-sm border-b border-outline-variant shrink-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">RENDER_STATE</span>
            </div>
            <div className="flex-1 bg-[#0A0A0A] p-2 font-code-sm text-code-sm space-y-1">
              <div className="flex justify-between"><span className="text-on-surface-variant">FPS</span><span className={fps < 30 ? 'text-error' : fps < 55 ? 'text-tertiary-fixed-dim' : 'text-primary-container'}>{fps}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">DRAW_CALLS</span><span className="text-on-surface">1</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">TRIANGLES</span><span className="text-on-surface">2</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">STATUS</span><span className={compileError ? 'text-error' : 'text-primary-container'}>{compileError ? 'ERROR' : 'ACTIVE'}</span></div>
            </div>
          </div>
          <div className="flex-1 min-h-[120px] flex flex-col">
            <div className="h-8 bg-[#111] flex items-center px-sm border-b border-outline-variant shrink-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">TEXTURE_SLOTS</span>
            </div>
            <div className="flex-1 bg-[#0A0A0A] p-2 flex gap-2">
              <div className="w-16 h-16 border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center relative">
                <span className="font-label-caps text-label-caps text-outline-variant absolute top-0 left-1">0</span>
                <div className="w-12 h-12 bg-gradient-to-tr from-purple-900 to-cyan-900 mt-2" />
              </div>
              <div className="w-16 h-16 border border-outline-variant bg-surface-container-low flex flex-col items-center justify-center relative">
                <span className="font-label-caps text-label-caps text-outline-variant absolute top-0 left-1">1</span>
                <span className="font-code-sm text-code-sm text-outline-variant mt-2">EMPTY</span>
              </div>
            </div>
          </div>
        </section>

        {/* Raster Output — REAL WebGL Canvas */}
        <section className="w-[35%] bg-surface flex flex-col border border-outline-variant min-w-[300px]">
          <div className="flex-[2] flex flex-col border-b border-outline-variant relative">
            <div className="h-8 bg-[#111]/80 backdrop-blur-sm flex items-center px-sm border-b border-outline-variant shrink-0 absolute top-0 w-full z-10">
              <span className="font-label-caps text-label-caps text-primary uppercase">RASTER_OUTPUT</span>
              <div className="ml-auto flex gap-2 font-code-sm text-code-sm text-outline-variant">
                <span>{canvasRef.current?.width || 0}x{canvasRef.current?.height || 0}</span>
                <span>RGBA8</span>
                <span className={compileError ? 'text-error' : 'text-primary-container'}>{fps}fps</span>
              </div>
            </div>
            <div className="flex-1 bg-surface-container-lowest relative overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-full" />
              {compileError && (
                <div className="absolute inset-0 bg-error/10 flex items-center justify-center p-4">
                  <div className="bg-surface-container border border-error p-4 max-w-sm font-code-sm text-code-sm text-error whitespace-pre-wrap">{compileError}</div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 flex border-t border-outline-variant">
            <div className="flex-1 border-r border-outline-variant flex flex-col">
              <div className="h-8 bg-[#111] flex items-center px-sm border-b border-outline-variant shrink-0">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">DRAW_CALL_SEQUENCE</span>
              </div>
              <div className="flex-1 overflow-auto bg-[#0A0A0A] p-2 font-code-sm text-code-sm">
                {drawCalls.map((dc, i) => (
                  <div key={i} className={`py-1 ${i === 0 ? 'text-outline-variant line-through' : i === drawCalls.length - 1 ? 'text-primary-container bg-primary-container/10 border-l-2 border-primary-container pl-1' : 'text-on-surface'}`}>{dc}</div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              <div className="h-8 bg-[#111] flex items-center px-sm border-b border-outline-variant shrink-0">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">PERF_METRICS</span>
              </div>
              <div className="flex-1 bg-[#0A0A0A] p-2 flex flex-col justify-around">
                <div>
                  <div className="flex justify-between font-label-caps text-label-caps mb-1"><span className="text-on-surface-variant">FPS</span><span className={fps < 30 ? 'text-error' : 'text-primary-container'}>{fps}</span></div>
                  <div className="h-2 bg-surface-container-high overflow-hidden"><div className="h-full bg-primary-container transition-all" style={{width:`${Math.min(fps/60*100,100)}%`}} /></div>
                </div>
                <div>
                  <div className="flex justify-between font-label-caps text-label-caps mb-1"><span className="text-on-surface-variant">GPU TIME</span><span className="text-tertiary-fixed-dim">{(1000/Math.max(fps,1)).toFixed(1)}ms</span></div>
                  <div className="h-2 bg-surface-container-high overflow-hidden"><div className="h-full bg-tertiary-fixed-dim transition-all" style={{width:`${Math.min((1000/Math.max(fps,1))/16.6*100,100)}%`}} /></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
