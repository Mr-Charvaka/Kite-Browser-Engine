import { useState, useEffect, useRef } from 'react';
import { useEngine } from '../core/EngineContext';
import { DOMArena } from '../core/memory/DOMArena';

type SidePanel = 'INSPECTOR' | 'MEMORY' | 'THREADS' | 'NETWORK' | 'SETTINGS' | 'LOGS' | 'SHELL';

const navItems: { id: SidePanel; icon: string }[] = [
  { id: 'INSPECTOR', icon: 'search' },
  { id: 'MEMORY', icon: 'memory' },
  { id: 'THREADS', icon: 'account_tree' },
  { id: 'NETWORK', icon: 'lan' },
  { id: 'SETTINGS', icon: 'settings' },
];

export default function SideNavBar() {
  const { state, reinitialize } = useEngine();
  const [activePanel, setActivePanel] = useState<SidePanel>('INSPECTOR');

  return (
    <aside className="w-64 bg-surface-container-low border-l border-outline-variant flex flex-col z-40 shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-sm mb-1">
          <span className="material-symbols-outlined text-primary text-[20px]">precision_manufacturing</span>
          <span className="font-headline-sm text-headline-sm text-primary">NODE_INSPECTOR</span>
        </div>
        <div className="font-code-sm text-code-sm text-on-surface-variant mb-2">
          PTR: 0x{((state.arenaStats.nodes * DOMArena.NODE_SIZE * 4) || 0).toString(16).toUpperCase().padStart(8, '0')}
        </div>
        <button
          className="w-full py-1 border border-primary text-primary font-label-caps text-label-caps hover:bg-primary-container/10 transition-colors active:scale-95"
          onClick={reinitialize}
        >
          REINITIALIZE
        </button>
      </div>

      {/* Navigation Buttons */}
      <nav className="py-1 px-2 space-y-0.5 border-b border-outline-variant shrink-0">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePanel(item.id)}
            className={`flex items-center px-2 py-1.5 space-x-2 w-full transition-all active:scale-95 font-label-caps text-label-caps text-[9px] ${
              activePanel === item.id
                ? 'bg-primary-container/10 text-primary border-r-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30 border-r-2 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={activePanel === item.id ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
            <span>{item.id}</span>
          </button>
        ))}
      </nav>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {activePanel === 'INSPECTOR' && <InspectorPanel />}
        {activePanel === 'MEMORY' && <MemoryPanel />}
        {activePanel === 'THREADS' && <ThreadsPanel />}
        {activePanel === 'NETWORK' && <NetworkPanel />}
        {activePanel === 'SETTINGS' && <SettingsPanel />}
        {activePanel === 'LOGS' && <LogsPanel />}
        {activePanel === 'SHELL' && <ShellPanel />}
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-outline-variant p-1 shrink-0">
        {(['LOGS', 'SHELL'] as SidePanel[]).map(id => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`flex items-center px-2 py-1 space-x-2 w-full transition-all active:scale-95 font-label-caps text-label-caps text-[9px] ${
              activePanel === id ? 'text-primary bg-primary-container/10' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{id === 'LOGS' ? 'terminal' : 'code'}</span>
            <span>{id}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ─── INSPECTOR Panel ─── */
function InspectorPanel() {
  const { state } = useEngine();
  const tree = state.domTree;
  if (!tree) return <div className="p-2 text-on-surface-variant font-code-sm text-code-sm italic">No DOM loaded</div>;

  const flatNodes: any[] = [];
  const flatten = (node: any, depth: number) => {
    flatNodes.push({ ...node, _depth: depth });
    node.children?.forEach((c: any) => flatten(c, depth + 1));
  };
  flatten(tree, 0);

  return (
    <div className="p-1 font-code-sm text-code-sm">
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">DOM_TREE ({flatNodes.length} nodes)</div>
      {flatNodes.map((node, i) => (
        <div key={i} className="flex items-center hover:bg-primary-container/10 px-1 py-0.5 cursor-default transition-colors" style={{ paddingLeft: node._depth * 12 + 4 }}>
          <span className="text-outline-variant text-[9px] mr-1">{node.type === 'Text' ? '·' : '▸'}</span>
          <span className={node.type === 'Text' ? 'text-on-surface-variant italic truncate text-[10px]' : 'text-primary-container text-[10px]'}>
            {node.type === 'Text' ? `"${node.textData?.slice(0, 16)}..."` : node.tagName}
          </span>
          <span className="ml-auto text-outline-variant text-[8px]">#{node.id}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── MEMORY Panel ─── */
function MemoryPanel() {
  const { state } = useEngine();
  const arena = state.arena;
  if (!arena) return <div className="p-2 text-on-surface-variant font-code-sm text-code-sm italic">No arena allocated</div>;

  const totalSlots = arena.nextNodeId;
  const usedBytes = totalSlots * DOMArena.NODE_SIZE * 4;
  const totalCapacity = arena.buffer.byteLength;
  const usage = (usedBytes / totalCapacity * 100);

  // Sample the raw buffer for hex dump
  const hexRows: string[][] = [];
  const rowCount = Math.min(totalSlots, 12);
  for (let i = 0; i < rowCount; i++) {
    const offset = i * DOMArena.NODE_SIZE;
    const cells: string[] = [];
    for (let j = 0; j < DOMArena.NODE_SIZE; j++) {
      cells.push(arena.buffer[offset + j].toString(16).toUpperCase().padStart(4, '0'));
    }
    hexRows.push(cells);
  }

  return (
    <div className="p-1 font-code-sm text-code-sm">
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">ARENA_ALLOCATOR</div>
      <div className="px-1 space-y-0.5 mb-2 text-[10px]">
        <div className="flex justify-between"><span className="text-on-surface-variant">USED:</span><span className="text-primary-container">{usedBytes.toLocaleString()} B</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">CAPACITY:</span><span className="text-on-surface">{totalCapacity.toLocaleString()} B</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">NODES:</span><span className="text-on-surface">{totalSlots - 1}</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">NODE_SIZE:</span><span className="text-on-surface">{DOMArena.NODE_SIZE * 4} bytes</span></div>
        <div className="h-1.5 bg-surface-container-lowest mt-1 overflow-hidden">
          <div className="h-full bg-primary-container transition-all" style={{ width: `${usage}%` }} />
        </div>
        <div className="text-[8px] text-on-surface-variant text-right">{usage.toFixed(1)}% used</div>
      </div>
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">STRING_TABLE ({arena.stringTable.length})</div>
      <div className="px-1 mb-2">
        {arena.stringTable.slice(0, 20).map((s, i) => (
          <div key={i} className="flex gap-1 text-[10px]">
            <span className="text-outline-variant w-4">{i}</span>
            <span className="text-on-surface truncate">{s ? `"${s}"` : '""'}</span>
          </div>
        ))}
      </div>
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">HEX_DUMP (Uint32Array)</div>
      <div className="px-1 overflow-x-auto">
        {hexRows.map((row, i) => (
          <div key={i} className="flex gap-1 text-[8px] font-mono">
            <span className="text-outline-variant w-6 shrink-0">{(i * DOMArena.NODE_SIZE).toString(16).padStart(3, '0')}</span>
            {row.map((cell, j) => (
              <span key={j} className={parseInt(cell, 16) > 0 ? 'text-primary-container' : 'text-on-surface-variant/30'}>{cell}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── THREADS Panel ─── */
function ThreadsPanel() {
  const [workers] = useState([
    { name: 'Main Thread', status: 'active', cpu: Math.floor(20 + Math.random() * 40) },
    { name: 'Parser Worker', status: 'idle', cpu: 0 },
    { name: 'Layout Worker', status: 'idle', cpu: 0 },
    { name: 'Raster Worker', status: 'idle', cpu: 0 },
  ]);

  return (
    <div className="p-1 font-code-sm text-code-sm">
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">THREAD_POOL ({workers.length})</div>
      {workers.map((w, i) => (
        <div key={i} className="px-1 py-1 border-b border-outline-variant/20">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-on-surface text-[10px]">{w.name}</span>
            <span className={`text-[8px] ${w.status === 'active' ? 'text-primary-container' : 'text-on-surface-variant'}`}>{w.status.toUpperCase()}</span>
          </div>
          <div className="h-1 bg-surface-container-lowest overflow-hidden">
            <div className={`h-full transition-all ${w.cpu > 60 ? 'bg-error' : w.cpu > 30 ? 'bg-tertiary-fixed-dim' : 'bg-primary-container/50'}`} style={{ width: `${w.cpu}%` }} />
          </div>
        </div>
      ))}
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mt-2 mb-1">TASK_SCHEDULER</div>
      <div className="px-1 space-y-0.5 text-[10px]">
        <div className="flex justify-between"><span className="text-on-surface-variant">PENDING:</span><span className="text-on-surface">0</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">COMPLETED:</span><span className="text-primary-container">{Math.floor(performance.now() / 100)}</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">SCHEDULER:</span><span className="text-on-surface">FIFO</span></div>
      </div>
    </div>
  );
}

/* ─── NETWORK Panel ─── */
function NetworkPanel() {
  const resources = [
    { url: '/index.html', type: 'document', size: '2.4KB', status: 200, time: '12ms', cached: false },
    { url: '/style.css', type: 'stylesheet', size: '8.1KB', status: 200, time: '5ms', cached: true },
    { url: '/app.js', type: 'script', size: '45.2KB', status: 200, time: '28ms', cached: false },
    { url: '/hero.jpg', type: 'image', size: '128KB', status: 200, time: '142ms', cached: false },
    { url: '/font.woff2', type: 'font', size: '24KB', status: 200, time: '18ms', cached: true },
  ];

  return (
    <div className="p-1 font-code-sm text-code-sm">
      <div className="text-primary-fixed-dim px-1 py-0.5 text-[9px] border-b border-outline-variant/50 mb-1">RESOURCE_LOADER ({resources.length})</div>
      {resources.map((r, i) => (
        <div key={i} className="px-1 py-1 border-b border-outline-variant/20 hover:bg-surface-variant/30 transition-colors">
          <div className="flex justify-between text-[10px]">
            <span className="text-primary-container truncate max-w-[120px]">{r.url}</span>
            <span className={`${r.cached ? 'text-secondary' : 'text-on-surface'}`}>{r.cached ? 'CACHED' : r.status}</span>
          </div>
          <div className="flex justify-between text-[8px] text-on-surface-variant">
            <span>{r.type}</span>
            <span>{r.size} — {r.time}</span>
          </div>
        </div>
      ))}
      <div className="px-1 mt-2 text-[10px] space-y-0.5">
        <div className="flex justify-between"><span className="text-on-surface-variant">TOTAL:</span><span className="text-on-surface">207.7KB</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">CACHED:</span><span className="text-secondary">32.1KB</span></div>
        <div className="flex justify-between"><span className="text-on-surface-variant">LATENCY:</span><span className="text-primary-container">41ms avg</span></div>
      </div>
    </div>
  );
}

/* ─── SETTINGS Panel ─── */
function SettingsPanel() {
  const [arenaSize, setArenaSize] = useState(1000);
  const [parseMode, setParseMode] = useState<'strict' | 'quirks'>('strict');
  const [traceEnabled, setTraceEnabled] = useState(true);

  return (
    <div className="p-2 font-code-sm text-code-sm space-y-3">
      <div className="text-primary-fixed-dim text-[9px] border-b border-outline-variant/50 pb-0.5">ENGINE_CONFIG</div>
      <div>
        <label className="text-on-surface-variant text-[10px] block mb-0.5">ARENA_CAPACITY (nodes)</label>
        <input type="number" value={arenaSize} onChange={e => setArenaSize(+e.target.value)}
          className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-[10px] px-1 py-0.5 focus:border-primary-container focus:outline-none" />
      </div>
      <div>
        <label className="text-on-surface-variant text-[10px] block mb-0.5">PARSE_MODE</label>
        <div className="flex gap-1">
          {(['strict', 'quirks'] as const).map(m => (
            <button key={m} onClick={() => setParseMode(m)}
              className={`flex-1 py-0.5 text-[9px] font-label-caps border active:scale-95 transition-all ${parseMode === m ? 'border-primary text-primary bg-primary-container/10' : 'border-outline-variant text-on-surface-variant'}`}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-on-surface-variant text-[10px]">TELEMETRY_TRACE</span>
        <button onClick={() => setTraceEnabled(!traceEnabled)}
          className={`w-8 h-4 rounded-full relative transition-colors ${traceEnabled ? 'bg-primary-container' : 'bg-outline-variant'}`}>
          <div className={`w-3 h-3 rounded-full bg-background absolute top-0.5 transition-all ${traceEnabled ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-on-surface-variant text-[10px]">GC_SIMULATION</span>
        <span className="text-primary-container text-[10px]">GENERATIONAL</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-on-surface-variant text-[10px]">MEMORY_BACKEND</span>
        <span className="text-on-surface text-[10px]">Uint32Array</span>
      </div>
    </div>
  );
}

/* ─── LOGS Panel ─── */
function LogsPanel() {
  const { state } = useEngine();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.telemetryLog.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="text-primary-fixed-dim px-2 py-0.5 text-[9px] border-b border-outline-variant/50 font-code-sm shrink-0">
        TELEMETRY_LOG ({state.telemetryLog.length})
      </div>
      <div className="flex-1 overflow-y-auto p-1 font-code-sm">
        {state.telemetryLog.length === 0 ? (
          <div className="text-on-surface-variant text-[10px] italic p-2">No events recorded. Compile to generate trace.</div>
        ) : (
          state.telemetryLog.map((evt, i) => (
            <div key={i} className="flex gap-1 text-[9px] py-0.5 border-b border-outline-variant/10 hover:bg-surface-variant/20 transition-colors">
              <span className={`w-3 shrink-0 ${evt.phase === 'B' ? 'text-primary-container' : evt.phase === 'E' ? 'text-tertiary-fixed-dim' : 'text-secondary'}`}>
                {evt.phase === 'B' ? '▶' : evt.phase === 'E' ? '■' : '●'}
              </span>
              <span className="text-on-surface-variant w-12 shrink-0">{evt.timestamp.toFixed(1)}ms</span>
              <span className="text-secondary shrink-0">[{evt.category}]</span>
              <span className="text-on-surface truncate">{evt.name}</span>
              {evt.args && <span className="ml-auto text-outline-variant shrink-0">{JSON.stringify(evt.args)}</span>}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

/* ─── SHELL Panel ─── */
function ShellPanel() {
  const { state, compile } = useEngine();
  const [history, setHistory] = useState<{ cmd: string; out: string }[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const execute = (cmd: string) => {
    let out = '';
    const parts = cmd.trim().toLowerCase().split(/\s+/);
    switch (parts[0]) {
      case 'help':
        out = 'Commands: help, stats, nodes, strings, dump <id>, compile, clear, tree'; break;
      case 'stats':
        out = `Nodes: ${state.arenaStats.nodes}\nBytes: ${state.arenaStats.bytes}\nDepth: ${state.arenaStats.depth}\nParse: ${state.parseTime.toFixed(2)}ms`; break;
      case 'nodes':
        out = `Total nodes: ${state.arenaStats.nodes}\nNode size: ${DOMArena.NODE_SIZE * 4} bytes\nArena: CONTIGUOUS Uint32Array`; break;
      case 'strings':
        out = state.arena?.stringTable.map((s, i) => `[${i}] "${s}"`).join('\n') || 'No arena'; break;
      case 'dump':
        const id = parseInt(parts[1] || '0');
        if (state.arena && id > 0 && id < state.arena.nextNodeId) {
          const off = id * DOMArena.NODE_SIZE;
          const vals = Array.from(state.arena.buffer.slice(off, off + DOMArena.NODE_SIZE));
          out = `Node #${id}:\n` + ['ID','PARENT','FIRST_CHILD','LAST_CHILD','NEXT_SIB','PREV_SIB','TYPE','TAG_NAME','TEXT_DATA','FLAGS'].map((f, i) => `  ${f}: ${vals[i]} (0x${vals[i].toString(16)})`).join('\n');
        } else { out = `Invalid node ID: ${id}`; }
        break;
      case 'compile':
        compile(); out = `Compiled: ${state.arenaStats.nodes} nodes in ${state.parseTime.toFixed(2)}ms`; break;
      case 'tree':
        const printTree = (node: any, depth: number): string => {
          if (!node) return '';
          const indent = '  '.repeat(depth);
          let s = `${indent}${node.type === 'Text' ? `"${node.textData?.slice(0, 20)}"` : `<${node.tagName}>`}\n`;
          node.children?.forEach((c: any) => { s += printTree(c, depth + 1); });
          return s;
        };
        out = printTree(state.domTree, 0) || 'No tree'; break;
      case 'clear':
        setHistory([]); return;
      default:
        out = `Unknown command: ${parts[0]}. Type "help" for commands.`;
    }
    setHistory(prev => [...prev, { cmd, out }]);
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-primary-fixed-dim px-2 py-0.5 text-[9px] border-b border-outline-variant/50 font-code-sm shrink-0">BEO_SHELL v1.0</div>
      <div className="flex-1 overflow-y-auto p-1 font-code-sm text-[10px]">
        <div className="text-on-surface-variant mb-1">Type "help" for available commands.</div>
        {history.map((h, i) => (
          <div key={i} className="mb-1">
            <div className="text-primary-container"><span className="text-primary">$ </span>{h.cmd}</div>
            <pre className="text-on-surface whitespace-pre-wrap pl-2">{h.out}</pre>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>
      <div className="border-t border-outline-variant flex items-center px-1 shrink-0">
        <span className="text-primary font-code-sm text-[10px] mr-1">$</span>
        <input
          className="flex-1 bg-transparent border-none text-on-surface font-code-sm text-[10px] focus:outline-none focus:ring-0 py-1"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && input.trim()) { execute(input.trim()); setInput(''); } }}
          placeholder="type command..."
          spellCheck={false}
        />
      </div>
    </div>
  );
}
