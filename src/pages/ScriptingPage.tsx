import { useState, useEffect, useCallback, useRef } from 'react';
import { TelemetryBus, TracePhase } from '../core/observability/TelemetryBus';

interface Task { name: string; start: number; duration: number; lane: string; color: string; sub?: string; tickId: number; }
interface MicroTask { name: string; trigger: string; status: 'pending' | 'resolved'; }
interface TickMarker { id: number; offset: number; }

const LANE_HEIGHT = 44;
const HEADER_W = 140;
const TICK_WINDOW = 12; // Each tick is 12ms

function generateTasks(): Task[] {
  const tasks: Task[] = [];
  const is = Math.random() * 0.5;
  tasks.push({ name: 'Input', start: is, duration: 0.3 + Math.random() * 0.4, lane: 'main', color: '#a78bfa', sub: 'keydown', tickId: 0 });
  const ss = is + 0.8 + Math.random() * 0.3;
  const sd = 1.5 + Math.random() * 1.5;
  tasks.push({ name: 'Evaluate Script', start: ss, duration: sd, lane: 'main', color: '#60a5fa', sub: `App.js:${Math.floor(Math.random() * 200)}`, tickId: 0 });
  if (Math.random() > 0.3) tasks.push({ name: 'GC', start: ss + sd + 0.1, duration: 0.2 + Math.random() * 0.6, lane: 'main', color: '#f87171', tickId: 0 });
  const as = ss + sd + 0.8 + Math.random() * 0.5;
  const ad = 2 + Math.random() * 2.5;
  tasks.push({ name: 'Animation Frame', start: as, duration: ad, lane: 'main', color: '#34d399', sub: 'render()', tickId: 0 });
  tasks.push({ name: 'Recalc Style', start: as + ad + 0.1, duration: 0.4 + Math.random() * 0.6, lane: 'main', color: '#fbbf24', sub: `${Math.floor(Math.random() * 40)} els`, tickId: 0 });
  tasks.push({ name: 'Layout', start: as + ad + 0.6 + Math.random() * 0.3, duration: 0.3 + Math.random() * 0.5, lane: 'main', color: '#fb923c', tickId: 0 });
  tasks.push({ name: 'Data Parse', start: 0.5 + Math.random() * 1.5, duration: 1.5 + Math.random() * 2, lane: 'worker1', color: '#818cf8', tickId: 0 });
  if (Math.random() > 0.4) tasks.push({ name: 'Wasm Exec', start: 4 + Math.random() * 2, duration: 1 + Math.random() * 1.5, lane: 'worker1', color: '#c084fc', tickId: 0 });
  if (Math.random() > 0.3) tasks.push({ name: 'Decode Image', start: 2 + Math.random() * 2, duration: 1 + Math.random() * 1.5, lane: 'worker2', color: '#67e8f9', tickId: 0 });
  if (Math.random() > 0.6) tasks.push({ name: 'IndexedDB', start: 5 + Math.random() * 2, duration: 0.5 + Math.random(), lane: 'worker2', color: '#86efac', tickId: 0 });
  tasks.push({ name: 'Rasterize', start: 7.5 + Math.random() * 1.5, duration: 0.8 + Math.random() * 0.5, lane: 'compositor', color: '#fcd34d', tickId: 0 });
  tasks.push({ name: 'Composite', start: 9.5 + Math.random() * 0.5, duration: 0.3 + Math.random() * 0.3, lane: 'compositor', color: '#fdba74', tickId: 0 });
  tasks.push({ name: 'Paint', start: 10.5 + Math.random() * 0.5, duration: 0.2 + Math.random() * 0.2, lane: 'compositor', color: '#a3e635', tickId: 0 });
  return tasks;
}

const lanes = [
  { id: 'main', label: 'Main Thread', icon: '◉', color: '#60a5fa' },
  { id: 'worker1', label: 'Worker 1', icon: '◎', color: '#818cf8' },
  { id: 'worker2', label: 'Worker 2', icon: '◎', color: '#67e8f9' },
  { id: 'compositor', label: 'Compositor', icon: '◈', color: '#fcd34d' },
];

export default function ScriptingPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [tickMarkers, setTickMarkers] = useState<TickMarker[]>([]);
  const [microtasks, setMicrotasks] = useState<MicroTask[]>([]);
  const [tickCount, setTickCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [playhead, setPlayhead] = useState(0);
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const playheadRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tickCountRef = useRef(0);

  const totalMs = tickCount * TICK_WINDOW || TICK_WINDOW;

  const tick = useCallback(() => {
    TelemetryBus.publish(TracePhase.Begin, 'EventLoop', 'Tick');
    const currentTick = tickCountRef.current;
    const offset = currentTick * TICK_WINDOW;
    const newTasks = generateTasks().map(t => ({ ...t, start: t.start + offset, tickId: currentTick }));

    const mt: MicroTask[] = [
      { name: 'Promise.resolve()', trigger: 'fetchUser()', status: Math.random() > 0.3 ? 'resolved' : 'pending' },
      { name: 'MutationObserver', trigger: '#app-root', status: 'pending' },
      { name: 'queueMicrotask()', trigger: 'setState()', status: Math.random() > 0.5 ? 'resolved' : 'pending' },
    ];
    if (Math.random() > 0.3) mt.push({ name: 'Promise.then()', trigger: 'IDB.onsuccess', status: 'pending' });
    if (Math.random() > 0.5) mt.push({ name: 'ResizeObserver', trigger: '.container', status: 'pending' });

    tickCountRef.current = currentTick + 1;
    setAllTasks(prev => [...prev, ...newTasks]);
    setTickMarkers(prev => [...prev, { id: currentTick, offset }]);
    setMicrotasks(mt);
    setTickCount(tickCountRef.current);
    setPlayhead(offset);

    // Auto-scroll to latest tick
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    }, 50);

    TelemetryBus.publish(TracePhase.End, 'EventLoop', 'Tick', { tick: currentTick });
  }, []);

  useEffect(() => {
    tick();
    intervalRef.current = setInterval(() => { if (!paused) tick(); }, 3000);
    return () => clearInterval(intervalRef.current);
  }, [tick, paused]);

  // Animate playhead
  useEffect(() => {
    if (paused) { clearInterval(playheadRef.current); return; }
    playheadRef.current = setInterval(() => {
      setPlayhead(p => {
        const max = tickCountRef.current * TICK_WINDOW;
        return p >= max ? max : p + 0.05;
      });
    }, 16);
    return () => clearInterval(playheadRef.current);
  }, [paused]);

  const handleClear = () => {
    setAllTasks([]);
    setTickMarkers([]);
    tickCountRef.current = 0;
    setTickCount(0);
    setPlayhead(0);
  };

  const handleGoToStart = () => {
    setPlayhead(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  };

  const handleGoToEnd = () => {
    const max = tickCountRef.current * TICK_WINDOW;
    setPlayhead(max);
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  };

  // Ruler clicking to set playhead
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    const ms = (x / totalWidth) * totalMs;
    setPlayhead(Math.max(0, Math.min(ms, totalMs)));
  };

  const pxPerMs = 80 * zoom;
  const totalWidth = Math.max(totalMs * pxPerMs, 800);
  const msToX = (ms: number) => ms * pxPerMs;

  const pendingCount = microtasks.filter(m => m.status === 'pending').length;

  // Ruler marks
  const majorStep = zoom > 1.5 ? 0.5 : zoom > 0.8 ? 1 : 2;
  const rulerMarks: number[] = [];
  for (let i = 0; i <= totalMs; i += majorStep) rulerMarks.push(i);

  // Track clip counts
  const clipCounts = lanes.reduce((acc, l) => { acc[l.id] = allTasks.filter(t => t.lane === l.id).length; return acc; }, {} as Record<string, number>);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col bg-[#0c0c0c] overflow-hidden">
        {/* Transport Bar */}
        <div className="h-9 bg-[#161616] border-b border-[#2a2a2a] flex items-center px-3 gap-2 shrink-0">
          <div className="flex items-center gap-0.5">
            <button onClick={handleGoToStart} className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors" title="Go to start">⏮</button>
            <button onClick={() => setPaused(!paused)} className={`w-7 h-7 flex items-center justify-center rounded font-bold text-sm transition-colors ${paused ? 'bg-[#3b82f6] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#444]'}`}>{paused ? '▶' : '⏸'}</button>
            <button onClick={tick} className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors" title="Step one tick">⏭</button>
            <button onClick={handleGoToEnd} className="w-6 h-6 flex items-center justify-center text-[#888] hover:text-white hover:bg-[#333] rounded transition-colors" title="Go to end">⏩</button>
          </div>
          <div className="h-5 w-px bg-[#333]" />
          <div className="font-mono text-[11px] text-[#3b82f6] tracking-wider bg-[#1a1a2e] px-2 py-0.5 rounded border border-[#2a2a4a]">
            {playhead.toFixed(1).padStart(6, '0')} ms
          </div>
          <div className="font-mono text-[10px] text-[#666]">TICK #{tickCount}</div>
          <div className="font-mono text-[10px] text-[#444]">|</div>
          <div className="font-mono text-[10px] text-[#555]">{allTasks.length} clips</div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleClear} className="text-[9px] text-[#666] hover:text-[#ef4444] font-mono px-1.5 py-0.5 hover:bg-[#222] rounded transition-colors" title="Clear history">CLEAR</button>
            <div className="h-4 w-px bg-[#333]" />
            <span className="text-[10px] text-[#666] font-mono">ZOOM</span>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.25))} className="w-5 h-5 flex items-center justify-center text-[#888] hover:text-white bg-[#222] hover:bg-[#333] rounded text-xs">−</button>
            <span className="text-[10px] text-[#aaa] font-mono w-8 text-center">{zoom.toFixed(1)}x</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="w-5 h-5 flex items-center justify-center text-[#888] hover:text-white bg-[#222] hover:bg-[#333] rounded text-xs">+</button>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Track Headers */}
          <div className="shrink-0 bg-[#141414] border-r border-[#2a2a2a] flex flex-col" style={{ width: HEADER_W }}>
            <div className="h-7 border-b border-[#2a2a2a] flex items-center justify-center">
              <span className="text-[8px] text-[#555] font-mono">TRACKS</span>
            </div>
            {lanes.map(lane => (
              <div key={lane.id} className="border-b border-[#1e1e1e] flex items-center gap-2 px-3 hover:bg-[#1a1a1a] transition-colors" style={{ height: LANE_HEIGHT }}>
                <span className="text-[12px]" style={{ color: lane.color }}>{lane.icon}</span>
                <div>
                  <div className="text-[10px] font-semibold text-[#ddd] leading-tight">{lane.label}</div>
                  <div className="text-[8px] text-[#555]">{clipCounts[lane.id] || 0} clips</div>
                </div>
                <div className="ml-auto"><div className="w-2 h-2 rounded-full" style={{ background: lane.color, opacity: 0.6 }} /></div>
              </div>
            ))}
          </div>

          {/* Scrollable Timeline */}
          <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
            <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
              {/* Ruler */}
              <div className="h-7 bg-[#161616] border-b border-[#2a2a2a] sticky top-0 z-20 relative cursor-pointer" onClick={handleRulerClick}>
                {rulerMarks.map(ms => (
                  <div key={ms} className="absolute top-0 h-full" style={{ left: msToX(ms) }}>
                    <div className="w-px h-full bg-[#2a2a2a]" />
                    {(ms % (zoom > 1.5 ? 1 : zoom > 0.8 ? 2 : 4) === 0) && (
                      <span className="absolute top-0.5 text-[9px] text-[#666] font-mono ml-1 select-none">{ms.toFixed(0)}ms</span>
                    )}
                  </div>
                ))}
                {/* Tick boundary markers on ruler */}
                {tickMarkers.map(tm => (
                  <div key={tm.id} className="absolute top-0 h-full" style={{ left: msToX(tm.offset) }}>
                    <div className="absolute bottom-0 left-0 bg-[#3b82f6]/80 text-white text-[7px] font-mono px-1 rounded-t-sm leading-tight">T{tm.id}</div>
                  </div>
                ))}
              </div>

              {/* Track Lanes */}
              {lanes.map((lane, li) => {
                const laneTasks = allTasks.filter(t => t.lane === lane.id);
                return (
                  <div key={lane.id} className="relative border-b border-[#1a1a1a]" style={{ height: LANE_HEIGHT }}>
                    <div className={`absolute inset-0 ${li % 2 === 0 ? 'bg-[#0f0f0f]' : 'bg-[#111]'}`} />
                    {/* Grid lines */}
                    {rulerMarks.filter((_, i) => i % (zoom > 1.5 ? 2 : 1) === 0).map(ms => (
                      <div key={ms} className="absolute top-0 w-px h-full bg-[#1a1a1a]" style={{ left: msToX(ms) }} />
                    ))}
                    {/* Tick boundary lines */}
                    {tickMarkers.map(tm => (
                      <div key={tm.id} className="absolute top-0 w-px h-full bg-[#3b82f6]/20" style={{ left: msToX(tm.offset) }} />
                    ))}
                    {/* Task clips */}
                    {laneTasks.map((task, i) => {
                      const x = msToX(task.start);
                      const w = Math.max(msToX(task.duration), 6);
                      const isHovered = hoveredTask === task;
                      // Dim older ticks
                      const isCurrentTick = task.tickId === tickCountRef.current - 1;
                      const opacity = isCurrentTick ? 1 : 0.55;
                      return (
                        <div
                          key={`${task.tickId}-${i}`}
                          className="absolute top-[5px] rounded-[3px] cursor-pointer transition-all duration-150 group"
                          style={{
                            left: x, width: w, height: LANE_HEIGHT - 10, opacity,
                            background: `linear-gradient(180deg, ${task.color}dd 0%, ${task.color}88 100%)`,
                            boxShadow: isHovered ? `0 0 12px ${task.color}66, inset 0 1px 0 ${task.color}88` : `inset 0 1px 0 ${task.color}44`,
                            border: `1px solid ${isHovered ? task.color : task.color + '55'}`,
                            zIndex: isHovered ? 10 : 1,
                            transform: isHovered ? 'scaleY(1.08)' : 'scaleY(1)',
                          }}
                          onMouseEnter={() => setHoveredTask(task)}
                          onMouseLeave={() => setHoveredTask(null)}
                        >
                          <div className="h-[2px] rounded-t-[3px]" style={{ background: task.color }} />
                          <div className="px-1 py-0.5 overflow-hidden h-full flex flex-col justify-center">
                            <div className="text-[9px] font-semibold text-white truncate leading-tight drop-shadow-sm">{task.name}</div>
                            {w > 50 && task.sub && <div className="text-[7px] text-white/60 truncate leading-tight">{task.sub}</div>}
                          </div>
                          <div className="absolute left-0 top-0 w-1 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-l-[3px]" style={{ background: task.color }} />
                          <div className="absolute right-0 top-0 w-1 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 rounded-r-[3px]" style={{ background: task.color }} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Playhead */}
              <div className="absolute top-0 z-30 pointer-events-none" style={{ left: msToX(playhead), height: '100%' }}>
                <div className="w-3 h-3 -ml-1.5 bg-[#ef4444]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
                <div className="w-px bg-[#ef4444] ml-[5px]" style={{ height: 'calc(100% - 12px)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div className="h-8 bg-[#161616] border-t border-[#2a2a2a] flex items-center px-3 gap-4 shrink-0">
          {hoveredTask ? (
            <>
              <span className="w-2 h-2 rounded-sm" style={{ background: hoveredTask.color }} />
              <span className="text-[10px] text-white font-semibold">{hoveredTask.name}</span>
              <span className="text-[10px] text-[#666]">|</span>
              <span className="text-[10px] text-[#888]">Tick <span className="text-[#aaa]">#{hoveredTask.tickId}</span></span>
              <span className="text-[10px] text-[#888]">Start: <span className="text-[#aaa]">{hoveredTask.start.toFixed(2)}ms</span></span>
              <span className="text-[10px] text-[#888]">Dur: <span className="text-[#aaa]">{hoveredTask.duration.toFixed(2)}ms</span></span>
              {hoveredTask.sub && <span className="text-[10px] text-[#555]">{hoveredTask.sub}</span>}
            </>
          ) : (
            <span className="text-[10px] text-[#555]">Hover a clip — {allTasks.length} total clips across {tickCount} ticks</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] text-[#555]">TOTAL: {totalMs.toFixed(0)}ms</span>
            <span className="text-[10px] text-[#555]">|</span>
            <span className={`text-[10px] ${paused ? 'text-[#3b82f6]' : 'text-[#22c55e]'}`}>{paused ? '⏸ PAUSED' : '● LIVE'}</span>
          </div>
        </div>
      </div>

      {/* Microtask Queue */}
      <aside className="w-72 bg-[#111] border-l border-[#2a2a2a] flex flex-col shrink-0">
        <div className="h-9 bg-[#161616] border-b border-[#2a2a2a] flex items-center px-3 justify-between shrink-0">
          <span className="text-[10px] font-semibold text-[#ddd] tracking-wider">MICROTASK QUEUE</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a2e] border border-[#2a2a4a] text-[#818cf8]">{pendingCount} pending</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {microtasks.map((mt, i) => (
            <div key={i} className={`px-3 py-2 border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors ${mt.status === 'resolved' ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${mt.status === 'resolved' ? 'text-[#22c55e]' : 'text-[#818cf8]'}`}>{mt.status === 'resolved' ? '✓' : '▸'}</span>
                <span className="text-[11px] text-[#ddd] font-semibold">{mt.name}</span>
              </div>
              <div className="text-[9px] text-[#555] mt-0.5 pl-4">Triggered by: {mt.trigger}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-[#2a2a2a] p-3 space-y-1.5 shrink-0 bg-[#0c0c0c]">
          <div className="text-[9px] text-[#555] font-semibold tracking-wider mb-1">SESSION_STATS</div>
          <div className="flex justify-between text-[10px]"><span className="text-[#666]">Ticks</span><span className="text-[#aaa]">{tickCount}</span></div>
          <div className="flex justify-between text-[10px]"><span className="text-[#666]">Total Clips</span><span className="text-[#aaa]">{allTasks.length}</span></div>
          <div className="flex justify-between text-[10px]"><span className="text-[#666]">Timeline</span><span className="text-[#aaa]">{totalMs.toFixed(0)}ms</span></div>
          <div className="flex justify-between text-[10px]"><span className="text-[#666]">Status</span><span className={paused ? 'text-[#3b82f6]' : 'text-[#22c55e]'}>{paused ? 'PAUSED' : 'RECORDING'}</span></div>
          {pendingCount > 3 && <div className="text-[9px] text-[#ef4444] mt-1">⚠ Queue depth &gt; 3</div>}
        </div>
      </aside>
    </div>
  );
}
