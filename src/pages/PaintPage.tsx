import { useState, useEffect, useCallback, useRef } from 'react';
import { useEngine } from '../core/EngineContext';
import { TelemetryBus, TracePhase } from '../core/observability/TelemetryBus';

interface PaintLayer {
  id: number;
  name: string;
  zIndex: number;
  x: number; y: number; w: number; h: number;
  opacity: number;
  compositing: string;
  paintOps: PaintOp[];
  rasterized: boolean;
  rasterTime: number;
}

interface PaintOp {
  type: 'drawRect' | 'drawText' | 'drawImage' | 'clipRect' | 'setOpacity' | 'drawBorder';
  args: string;
  cost: number;
}

interface Tile {
  row: number; col: number;
  status: 'pending' | 'rasterizing' | 'done' | 'cached';
  layer: number;
}

function generateLayers(domTree: any): PaintLayer[] {
  const layers: PaintLayer[] = [];
  let layerId = 0;

  const walk = (node: any, depth: number, yOff: number) => {
    if (!node || node.type === 'Text') return yOff;
    const tag = node.tagName || 'anon';
    if (tag === '#document') {
      let y = 0;
      node.children?.forEach((c: any) => { y = walk(c, depth, y); });
      return y;
    }

    const isLayer = node.type === 'Element'; // Every Element node gets a layer in real-time!
    if (isLayer) {
      const h = 30 + Math.random() * 60;
      const ops: PaintOp[] = [];

      // Generate realistic paint operations based on tag
      ops.push({ type: 'drawRect', args: `fill(${tag === 'header' ? '#1c1b1b' : tag === 'footer' ? '#201f1f' : '#131313'})`, cost: 0.01 + Math.random() * 0.05 });
      if (tag === 'img') {
        ops.push({ type: 'drawImage', args: `src="${tag}.jpg" decode=async`, cost: 0.5 + Math.random() * 2 });
      }
      const textChild = node.children?.find((c: any) => c.type === 'Text');
      if (textChild) {
        ops.push({ type: 'drawText', args: `"${textChild.textData.slice(0, 30)}" font=Inter`, cost: 0.02 + Math.random() * 0.1 });
      } else if (['h1', 'h2', 'p', 'a', 'span', 'title', 'button', 'label'].includes(tag)) {
        ops.push({ type: 'drawText', args: `"${tag}" font=Inter`, cost: 0.02 + Math.random() * 0.1 });
      }
      if (['header', 'footer', 'section', 'nav', 'div', 'main'].includes(tag)) {
        ops.push({ type: 'drawBorder', args: `1px solid #3b494b`, cost: 0.005 });
      }
      if (['section', 'div'].includes(tag)) {
        ops.push({ type: 'clipRect', args: `overflow:hidden`, cost: 0.002 });
      }

      const rasterTime = ops.reduce((s, o) => s + o.cost, 0);
      layers.push({
        id: layerId++,
        name: `${tag}${node.children?.length ? ` (${node.children.length})` : ''}`,
        zIndex: depth,
        x: 5 + depth * 3,
        y: yOff,
        w: 90 - depth * 6,
        h,
        opacity: 1,
        compositing: depth > 2 ? 'source-over' : 'normal',
        paintOps: ops,
        rasterized: false,
        rasterTime,
      });
      yOff += h + 2;
    }

    node.children?.forEach((c: any) => { yOff = walk(c, depth + 1, yOff); });
    return yOff;
  };

  walk(domTree, 0, 2);
  return layers;
}

function generateTiles(layers: PaintLayer[], cols: number, rows: number): Tile[] {
  const tiles: Tile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        row: r, col: c,
        status: 'pending',
        layer: Math.floor(Math.random() * layers.length),
      });
    }
  }
  return tiles;
}

export default function PaintPage() {
  const { state } = useEngine();
  const [layers, setLayers] = useState<PaintLayer[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<PaintLayer | null>(null);
  const [displayList, setDisplayList] = useState<PaintOp[]>([]);
  const [paintTime, setPaintTime] = useState(0);
  const [compositeTime, setCompositeTime] = useState(0);
  const [rasterProgress, setRasterProgress] = useState(0);
  const [isRasterizing, setIsRasterizing] = useState(false);
  const rasterIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const runPaint = useCallback(() => {
    if (!state.domTree) return [];
    const t0 = performance.now();
    TelemetryBus.publish(TracePhase.Begin, 'Paint', 'Layer Tree Build');

    const newLayers = generateLayers(state.domTree);
    const t1 = performance.now();
    TelemetryBus.publish(TracePhase.End, 'Paint', 'Layer Tree Build', { layers: newLayers.length });

    // Build composite display list from all layers
    const allOps = newLayers.flatMap(l => l.paintOps.map(op => ({ ...op, args: `[L${l.id}] ${op.args}` })));

    const t2 = performance.now();
    setLayers(newLayers);
    setDisplayList(allOps);
    setPaintTime(t1 - t0);
    setCompositeTime(t2 - t1);
    if (!selectedLayer && newLayers.length > 0) setSelectedLayer(newLayers[0]);

    // Generate tile grid
    const newTiles = generateTiles(newLayers, 12, 8);
    setTiles(newTiles);
    setRasterProgress(0);

    return newTiles;
  }, [state.domTree, selectedLayer]);

  // Simulate progressive rasterization
  const startRasterization = useCallback((tilesToRaster: Tile[]) => {
    if (rasterIntervalRef.current) clearInterval(rasterIntervalRef.current);
    setIsRasterizing(true);
    let idx = 0;
    rasterIntervalRef.current = setInterval(() => {
      if (idx >= tilesToRaster.length) {
        clearInterval(rasterIntervalRef.current);
        setIsRasterizing(false);
        setLayers(prev => prev.map(l => ({ ...l, rasterized: true })));
        return;
      }
      // Rasterize a batch of tiles
      const batch = Math.min(4 + Math.floor(Math.random() * 4), tilesToRaster.length - idx);
      setTiles(prev => {
        const next = [...prev];
        for (let i = idx; i < idx + batch && i < next.length; i++) {
          next[i] = { ...next[i], status: 'rasterizing' };
        }
        // Mark previous batch as done
        for (let i = Math.max(0, idx - batch); i < idx; i++) {
          next[i] = { ...next[i], status: Math.random() > 0.3 ? 'done' : 'cached' };
        }
        return next;
      });
      idx += batch;
      setRasterProgress(Math.min(100, Math.round(idx / tilesToRaster.length * 100)));
    }, 80);
  }, []);

  // Re-paint whenever the shared DOM tree changes
  useEffect(() => {
    if (!state.domTree) return;
    const t = runPaint();
    if (t && t.length > 0) startRasterization(t);
    return () => { if (rasterIntervalRef.current) clearInterval(rasterIntervalRef.current); };
  }, [state.domTree]);

  const handleReRaster = () => {
    const t = runPaint();
    startRasterization(t);
  };

  const totalPaintOps = displayList.length;
  const totalRasterMs = layers.reduce((s, l) => s + l.rasterTime, 0);
  const tilesDone = tiles.filter(t => t.status === 'done' || t.status === 'cached').length;
  const tilesCached = tiles.filter(t => t.status === 'cached').length;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Layer Stack + Tile Grid */}
      <div className="flex-1 flex flex-col bg-surface-container-lowest">
        {/* Layer Compositor Viewport */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full pane-header border-b border-outline-variant px-sm py-1 flex justify-between items-center z-10">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">COMPOSITOR // LAYER_STACK</span>
            <div className="flex items-center gap-sm">
              <span className="font-code-sm text-[10px] text-primary-fixed-dim">LAYERS: {layers.length}</span>
              <button className="font-label-caps text-label-caps bg-primary border border-primary px-2 py-0.5 text-on-primary active:scale-95" onClick={handleReRaster}>RE-RASTER</button>
            </div>
          </div>
          <div className="absolute inset-0 pt-8 p-4 overflow-y-auto grid-bg">
            {/* Flat stacked layer visualization */}
            <div className="flex flex-col gap-1">
              {layers.map((layer) => {
                const isSelected = selectedLayer?.id === layer.id;
                const colorClass = layer.rasterized
                  ? 'border-primary-container/40 bg-primary-container/8'
                  : 'border-outline-variant/40 bg-surface-container/50';
                return (
                  <div
                    key={layer.id}
                    className={`relative border transition-all duration-200 cursor-pointer ${colorClass} ${isSelected ? 'neon-glow border-primary bg-primary/5' : 'hover:border-primary-container/60 hover:bg-surface-variant/20'}`}
                    style={{
                      marginLeft: `${layer.zIndex * 16}px`,
                      height: '36px',
                    }}
                    onClick={() => setSelectedLayer(layer)}
                  >
                    <div className="flex items-center h-full px-3 gap-3">
                      {/* Layer index badge */}
                      <span className={`font-mono text-[9px] w-5 text-center shrink-0 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}>L{layer.id}</span>
                      {/* Layer name */}
                      <span className={`font-code-sm text-[11px] font-semibold truncate ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{layer.name}</span>
                      {/* Paint ops dots */}
                      <div className="flex gap-[3px] ml-2 shrink-0">
                        {layer.paintOps.map((op, j) => (
                          <div key={j} className={`w-[6px] h-[6px] rounded-sm ${op.type === 'drawImage' ? 'bg-secondary' : op.type === 'drawText' ? 'bg-tertiary-fixed-dim' : op.type === 'drawBorder' ? 'bg-outline' : 'bg-primary-container/50'}`} title={`${op.type}: ${op.args}`} />
                        ))}
                      </div>
                      {/* Raster status */}
                      <div className="ml-auto flex items-center gap-2 shrink-0">
                        <span className={`text-[8px] font-mono ${layer.rasterized ? 'text-primary-container' : 'text-tertiary-fixed-dim'}`}>{layer.rasterized ? 'RASTERIZED' : 'PENDING'}</span>
                        <span className="text-[8px] font-mono text-on-surface-variant">{layer.rasterTime.toFixed(2)}ms</span>
                        <span className="text-[8px] font-mono text-on-surface-variant">z:{layer.zIndex}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tile Rasterization Grid */}
        <div className="h-44 border-t border-outline-variant bg-surface-container-high flex flex-col shrink-0">
          <div className="pane-header px-sm py-1 flex justify-between items-center border-b border-outline-variant shrink-0">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">RASTERIZATION // TILE_GRID</span>
            <div className="flex items-center gap-sm">
              <span className={`font-code-sm text-[10px] ${isRasterizing ? 'text-tertiary-fixed-dim animate-pulse' : 'text-primary-container'}`}>
                {isRasterizing ? 'RASTERIZING...' : 'COMPLETE'} {rasterProgress}%
              </span>
              <span className="font-code-sm text-[10px] text-on-surface-variant">{tilesDone}/{tiles.length} tiles ({tilesCached} cached)</span>
            </div>
          </div>
          <div className="flex-1 p-2 flex flex-col">
            {/* Progress bar */}
            <div className="h-1.5 bg-surface-container-lowest mb-2 overflow-hidden">
              <div className="h-full bg-primary-container transition-all duration-200" style={{ width: `${rasterProgress}%` }} />
            </div>
            {/* Tile grid */}
            <div className="flex-1 grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
              {tiles.map((tile, i) => {
                const color = tile.status === 'done' ? 'bg-primary-container/20 border-primary-container/30'
                  : tile.status === 'cached' ? 'bg-secondary/15 border-secondary/30'
                  : tile.status === 'rasterizing' ? 'bg-tertiary-fixed-dim/30 border-tertiary-fixed-dim/50 animate-pulse'
                  : 'bg-surface-container-lowest border-outline-variant/20';
                return (
                  <div key={i} className={`border ${color} transition-colors duration-150`} title={`Tile ${tile.row},${tile.col} — ${tile.status}`} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Display List + Layer Inspector */}
      <div className="w-80 bg-surface-container-low flex flex-col shrink-0">
        {/* Layer Inspector */}
        <div className="h-56 border-b border-outline-variant flex flex-col shrink-0">
          <div className="pane-header px-sm py-1 border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase shrink-0">LAYER_INSPECTOR</div>
          {selectedLayer ? (
            <div className="flex-1 overflow-y-auto p-2 font-code-sm text-code-sm">
              <div className="text-tertiary-fixed-dim text-lg font-bold mb-1 capitalize">L{selectedLayer.id}: {selectedLayer.name}</div>
              <table className="w-full border-collapse">
                <tbody>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant w-24">z-index</td><td className="py-0.5 text-primary-container">{selectedLayer.zIndex}</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">bounds</td><td className="py-0.5 text-on-surface">{selectedLayer.x.toFixed(0)}%, {selectedLayer.y.toFixed(0)}% → {selectedLayer.w.toFixed(0)}%×{selectedLayer.h.toFixed(0)}px</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">opacity</td><td className="py-0.5 text-on-surface">{selectedLayer.opacity}</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">compositing</td><td className="py-0.5 text-secondary">{selectedLayer.compositing}</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">rasterized</td><td className={`py-0.5 ${selectedLayer.rasterized ? 'text-primary-container' : 'text-tertiary-fixed-dim'}`}>{selectedLayer.rasterized ? 'YES' : 'PENDING'}</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">paint_ops</td><td className="py-0.5 text-on-surface">{selectedLayer.paintOps.length}</td></tr>
                  <tr className="border-b border-outline-variant/30"><td className="py-0.5 text-on-surface-variant">raster_time</td><td className={`py-0.5 ${selectedLayer.rasterTime > 1 ? 'text-error' : 'text-primary-container'}`}>{selectedLayer.rasterTime.toFixed(2)}ms</td></tr>
                </tbody>
              </table>
              <div className="mt-2 text-primary-fixed-dim border-b border-outline-variant/50 mb-1 pb-0.5">PAINT_COMMANDS</div>
              {selectedLayer.paintOps.map((op, i) => (
                <div key={i} className="flex items-center gap-1 py-0.5">
                  <span className={`w-1.5 h-1.5 shrink-0 ${op.type === 'drawImage' ? 'bg-secondary' : op.type === 'drawText' ? 'bg-tertiary-fixed-dim' : op.type === 'drawBorder' ? 'bg-outline' : 'bg-primary-container/50'}`} />
                  <span className="text-on-surface-variant text-[10px]">{op.type}</span>
                  <span className="text-on-surface text-[10px] truncate">{op.args}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-on-surface-variant font-code-sm text-code-sm italic">Select a layer</div>
          )}
        </div>

        {/* Display List */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="pane-header px-sm py-1 border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase flex justify-between shrink-0">
            <span>DISPLAY_LIST</span>
            <span className="text-primary-container">{totalPaintOps} OPS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1 font-code-sm text-[10px]">
            {displayList.map((op, i) => (
              <div key={i} className="flex items-center gap-1 py-0.5 px-1 hover:bg-surface-variant/30 transition-colors border-b border-outline-variant/10">
                <span className="text-outline-variant w-6 text-right shrink-0">{i.toString().padStart(3, '0')}</span>
                <span className={`shrink-0 ${op.type === 'drawImage' ? 'text-secondary' : op.type === 'drawText' ? 'text-tertiary-fixed-dim' : op.type === 'drawBorder' ? 'text-outline' : op.type === 'clipRect' ? 'text-error' : 'text-primary-container'}`}>{op.type}</span>
                <span className="text-on-surface-variant truncate">{op.args}</span>
                <span className={`ml-auto shrink-0 ${op.cost > 0.5 ? 'text-error' : 'text-on-surface-variant'}`}>{op.cost.toFixed(2)}ms</span>
              </div>
            ))}
          </div>
        </div>

        {/* Paint Metrics */}
        <div className="h-24 border-t border-outline-variant flex flex-col shrink-0">
          <div className="pane-header px-sm py-1 border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase shrink-0">PAINT_METRICS</div>
          <div className="flex-1 p-2 font-code-sm text-code-sm grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between"><span className="text-on-surface-variant">PAINT:</span><span className="text-primary-container">{paintTime.toFixed(2)}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">COMPOSITE:</span><span className="text-primary-container">{compositeTime.toFixed(3)}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">RASTER:</span><span className={totalRasterMs > 5 ? 'text-error' : 'text-tertiary-fixed-dim'}>{totalRasterMs.toFixed(2)}ms</span></div>
            <div className="flex justify-between"><span className="text-on-surface-variant">LAYERS:</span><span className="text-on-surface">{layers.length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
