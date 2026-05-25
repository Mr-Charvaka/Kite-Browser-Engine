import { useState, useEffect, useCallback, useRef } from 'react';
import { DOMArena } from '../core/memory/DOMArena';
import { TokenType } from '../core/html/HTMLTokenizer';
import { useEngine } from '../core/EngineContext';

// DEFAULT_HTML is now managed in EngineContext

function SpatialNodeRenderer({ node, depth = 0, selectedId, onSelect }: { node: any; depth?: number; selectedId: number | null; onSelect: (node: any) => void }) {
  if (!node || node.type === 'Text') return null;
  const inset = depth * 16;
  const translateZ = depth * 40;
  const isSelected = selectedId === node.id;
  const colors = [
    'border-primary-container/30 bg-primary-container/5 text-primary-container',
    'border-secondary-fixed/50 bg-secondary-fixed/5 text-secondary-fixed',
    'border-tertiary-fixed-dim/50 bg-tertiary-fixed-dim/5 text-tertiary-fixed-dim',
    'border-outline/50 bg-outline/5 text-outline',
  ];
  const colorClass = isSelected ? 'border-primary bg-primary/10 text-primary neon-glow' : colors[depth % colors.length];
  return (
    <div
      className={`absolute transition-all duration-300 flex items-start justify-center pt-4 border cursor-pointer ${colorClass}`}
      style={{ top: inset, bottom: inset, left: inset, right: inset, transform: `translateZ(${translateZ}px)` }}
      onClick={(e) => { e.stopPropagation(); onSelect(node); }}
    >
      <span className={`font-code-sm text-code-sm bg-background px-1 capitalize ${isSelected ? 'text-primary font-bold' : ''}`}>
        {node.tagName === '#document' ? 'Document' : node.tagName}
        {isSelected && ' (Active)'}
      </span>
      {node.children?.filter((c: any) => c.type !== 'Text').map((child: any, idx: number) => (
        <SpatialNodeRenderer key={idx} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function DOMPage() {
  const { state, setHtmlInput, compile } = useEngine();
  const htmlInput = state.htmlInput;
  const domTree = state.domTree;
  const tokens = state.tokens;
  const arenaStats = state.arenaStats;
  const parseTime = state.parseTime;

  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [byteHistory, setByteHistory] = useState<number[]>([]);
  const [camRotation, setCamRotation] = useState({ x: 20, y: -30 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-compile on every keystroke (debounced 300ms)
  const handleInputChange = useCallback((val: string) => {
    setHtmlInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => compile(val), 300);
  }, [setHtmlInput, compile]);

  // Track byte history for sparkline
  useEffect(() => {
    if (arenaStats.bytes > 0) {
      setByteHistory(prev => {
        const next = [...prev, arenaStats.bytes];
        return next.length > 20 ? next.slice(-20) : next;
      });
    }
  }, [arenaStats.bytes]);

  const handleNodeSelect = (node: any) => setSelectedNode(node);
  const handleResetCam = () => setCamRotation({ x: 20, y: -30 });

  // Build sparkline from byte history
  const sparkPoints = byteHistory.length > 1
    ? byteHistory.map((v, i) => {
        const x = (i / (byteHistory.length - 1)) * 100;
        const maxV = Math.max(...byteHistory, 1);
        const y = 40 - (v / maxV) * 35;
        return `${x},${y}`;
      }).join(' ')
    : '0,20 100,20';

  // Find children info for selected node
  const selChildren = selectedNode?.children?.length ?? 0;
  const selType = selectedNode?.type ?? 'N/A';
  const selTag = selectedNode?.tagName ?? 'N/A';
  const selId = selectedNode?.id ?? 0;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Pane: Editor + Tokenizer */}
      <aside className="w-80 flex flex-col border-r border-outline-variant bg-[#0A0A0A] shrink-0">
        <div className="bg-[#111] h-8 flex items-center justify-between px-sm border-b border-outline-variant shrink-0">
          <span className="font-label-caps text-label-caps text-on-surface-variant">INPUT // HTML</span>
          <span className="font-code-sm text-[10px] text-primary-fixed-dim">{htmlInput.length} chars</span>
        </div>
        <div className="h-48 border-b border-outline-variant shrink-0">
          <textarea
            className="w-full h-full bg-[#050505] text-primary-fixed-dim font-code-sm text-code-sm p-sm outline-none resize-none border-none focus:ring-0"
            value={htmlInput}
            onChange={e => handleInputChange(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="bg-[#111] h-8 flex items-center justify-between px-sm border-b border-outline-variant shrink-0">
          <span className="font-label-caps text-label-caps text-on-surface-variant">RAW_STREAM // TOKENIZER</span>
          <span className="font-code-sm text-[10px] text-primary-container">{tokens.length} tokens</span>
        </div>
        <div className="flex-1 overflow-y-auto p-sm font-code-sm text-code-sm">
          <table className="w-full text-left border-collapse">
            <tbody>
              {tokens.map((token, idx) => (
                <tr key={idx} className="border-b border-outline-variant/30 hover:bg-primary-container/10 transition-colors">
                  <td className="py-1 text-on-surface-variant w-12">{idx.toString().padStart(4, '0')}</td>
                  <td className="py-1 text-secondary w-20">{TokenType[token.type]}</td>
                  <td className="py-1 text-on-surface whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                    {token.type === TokenType.Character
                      ? token.data
                      : token.type === TokenType.StartTag
                        ? `<${token.tagName}>`
                        : token.type === TokenType.EndTag
                          ? `</${token.tagName}>`
                          : 'EOF'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Byte Velocity sparkline — real data */}
        <div className="h-32 border-t border-outline-variant p-sm flex flex-col bg-[#050505] shrink-0">
          <div className="flex justify-between mb-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant">BYTE_VELOCITY</span>
            <span className="font-code-sm text-[10px] text-primary-container">{arenaStats.bytes}B</span>
          </div>
          <div className="flex-1 border-b border-l border-outline-variant relative">
            <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
              <polyline fill="none" points={sparkPoints} stroke="#00f0ff" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </aside>

      {/* Center Pane: 3D Visualization */}
      <main className="flex-1 flex flex-col bg-[#050505] relative">
        <div className="bg-[#111] h-8 flex justify-between items-center px-sm border-b border-outline-variant absolute top-0 w-full z-10 shrink-0">
          <span className="font-label-caps text-label-caps text-on-surface-variant">DOM_CONSTRUCTOR // SPATIAL_VIEW</span>
          <div className="flex gap-sm items-center">
            <span className="font-code-sm text-[10px] text-primary-fixed-dim">PARSE: {parseTime.toFixed(2)}ms</span>
            <button className="font-label-caps text-label-caps bg-surface-container-high border border-outline-variant px-2 py-0.5 text-on-surface hover:text-primary-container transition-colors active:scale-95" onClick={handleResetCam}>RESET_CAM</button>
            <button className="font-label-caps text-label-caps bg-primary border border-primary px-2 py-0.5 text-on-primary font-bold active:scale-95" onClick={() => compile()}>COMPILE</button>
          </div>
        </div>
        <div className="flex-1 relative flex items-center justify-center overflow-hidden pt-8" style={{ perspective: '1000px' }}>
          <div
            className="w-96 h-96 relative transition-transform duration-300"
            style={{ transformStyle: 'preserve-3d', transform: `rotateX(${camRotation.x}deg) rotateY(${camRotation.y}deg)` }}
          >
            {domTree && <SpatialNodeRenderer node={domTree} selectedId={selectedNode?.id ?? null} onSelect={handleNodeSelect} />}
          </div>
          {/* Floating Metrics — live data */}
          <div className="absolute bottom-4 right-4 bg-surface-container-low border border-outline-variant p-sm font-code-sm text-code-sm w-52 opacity-90">
            <div className="text-primary-fixed-dim mb-xs border-b border-outline-variant/50 pb-xs">RENDER_METRICS</div>
            <div className="flex justify-between"><span className="text-on-surface-variant">NODES:</span> <span className="text-on-surface">{arenaStats.nodes.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">DEPTH:</span> <span className="text-on-surface">{arenaStats.depth}</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">MALLOC:</span> <span className="text-secondary-fixed-dim">{(arenaStats.bytes / 1024).toFixed(1)}KB</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">PARSE_T:</span> <span className="text-tertiary-fixed-dim">{parseTime.toFixed(2)}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">ARENA:</span> <span className="text-on-surface">CONTIGUOUS</span></div>
          </div>
        </div>
      </main>

      {/* Right Pane: Live Node Inspector */}
      <aside className="w-72 flex flex-col border-l border-outline-variant bg-[#0A0A0A] shrink-0">
        <div className="bg-[#111] h-8 flex items-center px-sm border-b border-outline-variant shrink-0">
          <span className="font-label-caps text-label-caps text-on-surface-variant">NODE_PROPERTIES</span>
        </div>
        {selectedNode ? (
          <>
            <div className="p-sm border-b border-outline-variant bg-surface-container">
              <div className="font-display-data text-display-data text-tertiary-fixed-dim mb-xs capitalize">{selTag === '#document' ? 'Document' : selTag}</div>
              <div className="font-code-sm text-code-sm text-on-surface-variant">PTR: <span className="text-primary-container">0x{(selId * DOMArena.NODE_SIZE * 4).toString(16).toUpperCase().padStart(8, '0')}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto font-code-sm text-code-sm">
              <div className="p-sm">
                <div className="text-primary-fixed-dim border-b border-outline-variant/50 mb-xs pb-xs">NODE_DATA</div>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary w-20">type</td><td className="py-1 text-on-surface">{selType}</td></tr>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary">tag</td><td className="py-1 text-on-surface">{selTag}</td></tr>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary">id</td><td className="py-1 text-primary-container">{selId}</td></tr>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary">children</td><td className="py-1 text-on-surface">{selChildren}</td></tr>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary">offset</td><td className="py-1 text-tertiary-fixed-dim">{selId * DOMArena.NODE_SIZE}</td></tr>
                    <tr className="border-b border-outline-variant/30"><td className="py-1 text-secondary">size</td><td className="py-1 text-tertiary-fixed-dim">{DOMArena.NODE_SIZE * 4} bytes</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="p-sm">
                <div className="text-primary-fixed-dim border-b border-outline-variant/50 mb-xs pb-xs">CHILD_NODES</div>
                {selectedNode.children?.length > 0 ? (
                  <ul className="space-y-1">
                    {selectedNode.children.map((c: any, i: number) => (
                      <li key={i} className="flex justify-between items-center hover:bg-primary-container/10 px-1 py-0.5 cursor-pointer transition-colors" onClick={() => setSelectedNode(c)}>
                        <span className="text-on-surface capitalize">{c.tagName === '#text' ? `"${c.textData?.slice(0, 20)}..."` : c.tagName}</span>
                        <span className="text-on-surface-variant text-[10px]">{c.type}</span>
                      </li>
                    ))}
                  </ul>
                ) : <span className="text-on-surface-variant italic">No children</span>}
              </div>
              <div className="p-sm">
                <div className="text-primary-fixed-dim border-b border-outline-variant/50 mb-xs pb-xs">MEMORY_LAYOUT</div>
                <div className="font-code-sm text-[10px] text-on-surface-variant space-y-0.5">
                  {['ID','PARENT','FIRST_CHILD','LAST_CHILD','NEXT_SIB','PREV_SIB','TYPE','TAG_NAME','TEXT_DATA','FLAGS'].map((field, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{field}</span>
                      <span className="text-primary-container">0x{(i).toString(16).toUpperCase().padStart(2, '0')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant font-code-sm text-code-sm">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px] text-outline-variant/30 block mb-2">touch_app</span>
              Click a node in the spatial view to inspect
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
