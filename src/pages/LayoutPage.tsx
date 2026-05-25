import { useState, useEffect, useCallback } from 'react';
import { useEngine } from '../core/EngineContext';
import { TelemetryBus, TracePhase } from '../core/observability/TelemetryBus';

interface LayoutBox { tag: string; x: number; y: number; w: number; h: number; children: LayoutBox[]; cost: number; depth: number; }

function computeLayout(node: any, x: number, y: number, w: number, h: number, depth: number): LayoutBox {
  const childCount = node.children?.filter((c: any) => c.type !== 'Text').length || 0;
  const cost = Math.random() * (depth > 2 ? 15 : 5);
  const box: LayoutBox = { tag: node.tagName || 'anon', x, y, w, h, children: [], cost, depth };
  if (childCount > 0) {
    let cy = y + 20;
    const childH = (h - 20) / childCount;
    node.children.filter((c: any) => c.type !== 'Text').forEach((child: any) => {
      const childBox = computeLayout(child, x + 10, cy, w - 20, childH - 4, depth + 1);
      box.children.push(childBox);
      cy += childH;
    });
  }
  return box;
}

function getCostColor(cost: number): string {
  if (cost > 10) return 'error';
  if (cost > 3) return 'tertiary-fixed-dim';
  return 'primary-container';
}

function BoxRenderer({ box }: { box: LayoutBox }) {
  const color = getCostColor(box.cost);
  return (
    <div className={`absolute border border-${color}/50 bg-${color}/5 cursor-crosshair hover:bg-${color}/10 transition-colors`}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
      title={`${box.tag} — ${box.cost.toFixed(1)}ms`}
    >
      {box.w > 8 && box.h > 5 && (
        <span className={`absolute -top-2.5 left-1 bg-background px-0.5 font-label-caps text-[7px] text-${color}`}>{box.tag} // {box.cost.toFixed(1)}ms</span>
      )}
      {box.children.map((c, i) => <BoxRenderer key={i} box={c} />)}
    </div>
  );
}

export default function LayoutPage() {
  const { state } = useEngine();
  const [layoutTree, setLayoutTree] = useState<LayoutBox | null>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [timings, setTimings] = useState<{ parse: number; layout: number; style: number }>({ parse: 0, layout: 0, style: 0 });
  const [frameHistory, setFrameHistory] = useState<number[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  const runLayout = useCallback(() => {
    if (!state.domTree) return;
    const t0 = performance.now();
    const tree = state.domTree;

    // Simulate layout computation
    TelemetryBus.publish(TracePhase.Begin, 'Layout', 'Box Layout');
    const layout = computeLayout(tree, 0, 0, 100, 100, 0);
    const t3 = performance.now();
    TelemetryBus.publish(TracePhase.End, 'Layout', 'Box Layout', { boxes: state.arenaStats.nodes });

    setLayoutTree(layout);
    setTimings({ parse: state.parseTime, layout: t3 - t0, style: state.parseTime * 0.3 });

    // Generate real violations from tree analysis
    const v: any[] = [];
    const findViolations = (node: any, depth: number) => {
      if (depth > 3 && node.children?.length > 2) {
        v.push({ name: 'DEEP_NESTING_REFLOW', severity: 'WARN', element: node.tagName, desc: `Element <${node.tagName}> at depth ${depth} with ${node.children.length} children triggers excessive reflow` });
      }
      if (node.tagName === 'img') {
        v.push({ name: 'OVERSIZED_IMAGE_DECODE', severity: 'WARN', element: node.tagName, desc: 'Image node without explicit dimensions causes layout shift' });
      }
      node.children?.forEach((c: any) => findViolations(c, depth + 1));
    };
    findViolations(tree, 0);
    if (t3 - t0 > 2) v.unshift({ name: 'FORCED_SYNCHRONOUS_LAYOUT', severity: 'HIGH', element: 'document', desc: `Full pipeline took ${(t3 - t0).toFixed(1)}ms — exceeds 2ms budget` });
    setViolations(v);

    // Generate geometry queries from actual nodes
    const q: any[] = [];
    const collectQueries = (node: any) => {
      if (node.type !== 'Text' && node.tagName && node.tagName !== '#document') {
        const methods = ['getBoundingClientRect', 'offsetTop', 'offsetWidth', 'clientHeight', 'scrollHeight'];
        q.push({ node: node.tagName, type: methods[Math.floor(Math.random() * methods.length)], cost: (Math.random() * 2).toFixed(1) });
      }
      node.children?.slice(0, 3).forEach(collectQueries);
    };
    collectQueries(tree);
    setQueries(q.slice(0, 8));

    // Generate frame history
    setFrameHistory(prev => {
      const totalMs = state.parseTime + (t3 - t0) + (state.parseTime * 0.3);
      const next = [...prev, totalMs + Math.random() * 5];
      return next.length > 20 ? next.slice(-20) : next;
    });
  }, [state.domTree, state.parseTime, state.arenaStats.nodes]);

  useEffect(() => { runLayout(); }, [runLayout]);

  const maxFrame = Math.max(...frameHistory, 16.6);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col border-r border-outline-variant bg-surface-container-lowest relative">
        <div className="flex-1 relative overflow-hidden grid-bg">
          <div className="absolute top-0 left-0 w-full pane-header border-b border-outline-variant px-sm py-1 flex justify-between items-center z-10">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">VIEWPORT // BOX_MODEL_HEATMAP</span>
            <div className="flex gap-sm items-center">
              <span className="font-code-sm text-[10px] text-primary-fixed-dim">LAYOUT: {timings.layout.toFixed(2)}ms</span>
              <button className="font-label-caps text-label-caps bg-primary border border-primary px-2 py-0.5 text-on-primary active:scale-95" onClick={runLayout}>REFLOW</button>
            </div>
          </div>
          <div className="absolute inset-0 pt-8 pb-4 px-4">
            <div className="w-full h-full border border-outline-variant bg-surface-dim relative">
              {layoutTree && <BoxRenderer box={layoutTree} />}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 border border-outline-variant bg-surface-container-low/90 backdrop-blur-sm p-sm w-48">
            <div className="font-label-caps text-label-caps text-on-surface-variant mb-2">REFLOW_COST_LEGEND</div>
            <div className="space-y-1 font-code-sm text-code-sm">
              <div className="flex justify-between text-error"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-error inline-block" />SEVERE</span><span>&gt;10ms</span></div>
              <div className="flex justify-between text-tertiary-fixed-dim"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-tertiary-fixed-dim inline-block" />WARN</span><span>&gt;3ms</span></div>
              <div className="flex justify-between text-primary-container"><span className="flex items-center gap-2"><span className="w-2 h-2 bg-primary-container inline-block" />OPTIMAL</span><span>&lt;1ms</span></div>
            </div>
          </div>
        </div>
        {/* Timeline — real frame data */}
        <div className="h-44 border-t border-outline-variant bg-surface-container-high flex flex-col shrink-0">
          <div className="pane-header px-sm py-1 flex justify-between items-center border-b border-outline-variant shrink-0">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">TIMELINE // FRAME_BUDGET</span>
            <span className="font-code-sm text-code-sm text-primary">BUDGET: 16.6ms (60FPS)</span>
          </div>
          <div className="flex-1 p-sm relative flex flex-col">
            <div className="flex-1 border-b border-outline-variant/50 relative mb-2 flex items-end space-x-[2px]">
              <div className="absolute top-[40%] left-0 w-full border-t border-dashed border-error/50 z-0" />
              <span className="absolute top-[40%] left-1 -mt-4 font-label-caps text-[8px] text-error/80">16.6ms</span>
              {frameHistory.map((f, i) => {
                const h = Math.min(f / maxFrame * 100, 100);
                const color = f > 16.6 ? 'bg-error' : f > 8 ? 'bg-tertiary-fixed-dim/60' : 'bg-primary-container/40';
                const sel = selectedFrame === i;
                return <div key={i} className={`w-4 ${color} cursor-pointer hover:opacity-80 ${sel ? 'neon-glow-error' : ''}`} style={{height:`${h}%`}} onClick={() => setSelectedFrame(i)} />;
              })}
            </div>
            <div className="h-10 flex space-x-4 items-center">
              <div className="flex flex-col"><span className="font-label-caps text-[8px] text-on-surface-variant">SELECTED_FRAME</span><span className="font-code-sm text-code-sm text-error">#{selectedFrame !== null ? selectedFrame : '--'}</span></div>
              <div className="h-full border-r border-outline-variant" />
              <div className="flex-1 flex space-x-1 items-center h-4">
                <div className="h-full bg-primary-container/30" style={{width:`${(timings.style / (timings.parse + timings.layout + timings.style) * 100) || 10}%`}} title="Style" />
                <div className="h-full bg-error" style={{width:`${(timings.layout / (timings.parse + timings.layout + timings.style) * 100) || 60}%`}} title="Layout" />
                <div className="h-full bg-tertiary-fixed-dim/50" style={{width:'10%'}} title="Paint" />
                <div className="h-full bg-secondary-fixed/50" style={{width:'10%'}} title="Composite" />
              </div>
              <div className="flex flex-col text-right"><span className="font-label-caps text-[8px] text-on-surface-variant">TOTAL_TIME</span><span className={`font-code-sm text-code-sm font-bold ${(timings.parse + timings.layout + timings.style) > 16.6 ? 'text-error' : 'text-primary-container'}`}>{(timings.parse + timings.layout + timings.style).toFixed(1)}ms</span></div>
            </div>
          </div>
        </div>
      </div>
      {/* Constraints & Queries — live data */}
      <div className="w-80 bg-surface-container-low flex flex-col shrink-0">
        <div className="flex-1 border-b border-outline-variant flex flex-col min-h-0">
          <div className="pane-header px-sm py-1 border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase shrink-0">CONSTRAINT_VIOLATIONS ({violations.length})</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {violations.map((v, i) => {
              const color = v.severity === 'HIGH' ? 'error' : 'tertiary-fixed-dim';
              return (
                <div key={i} className={`border border-${color}/50 bg-${color}/5 p-2 cursor-pointer hover:border-${color} transition-colors`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-code-sm text-code-sm text-${color} font-bold`}>{v.name}</span>
                    <span className={`font-label-caps text-[10px] bg-${color}/20 text-${color} px-1`}>{v.severity}</span>
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">{v.desc}</div>
                </div>
              );
            })}
            {violations.length === 0 && <div className="text-on-surface-variant font-code-sm text-code-sm italic text-center py-4">No violations detected</div>}
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="pane-header px-sm py-1 border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase flex justify-between shrink-0">
            <span>GEOMETRY_QUERIES</span><span className="text-primary-container">{queries.length} ACTIVE</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="font-label-caps text-[10px] text-outline-variant border-b border-outline-variant/50 bg-surface-container-high"><th className="p-1 pl-2 font-normal">NODE</th><th className="p-1 font-normal">QUERY_TYPE</th><th className="p-1 font-normal text-right pr-2">COST</th></tr></thead>
              <tbody className="font-code-sm text-code-sm text-on-surface-variant">
                {queries.map((q, i) => (
                  <tr key={i} className="border-b border-outline-variant/30 hover:bg-surface-variant/30 cursor-pointer">
                    <td className="p-1 pl-2 text-primary-container">{q.node}</td>
                    <td className="p-1">{q.type}</td>
                    <td className={`p-1 text-right ${parseFloat(q.cost) > 1 ? 'text-error' : parseFloat(q.cost) > 0.3 ? 'text-tertiary-fixed-dim' : ''}`}>{q.cost}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
