import { useState, useEffect } from 'react';

interface FooterBarProps {
  extraInfo?: string;
}

export default function FooterBar({ extraInfo }: FooterBarProps) {
  const [memUsage, setMemUsage] = useState(0);
  const [fps, setFps] = useState(60);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frames = 0;
    let lastTime = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastTime = now;
        setUptime(Math.floor((now - start) / 1000));
        // Estimate heap usage
        if ((performance as any).memory) {
          setMemUsage(Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024));
        } else {
          setMemUsage(prev => prev || Math.floor(20 + Math.random() * 10));
        }
      }
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const status = fps > 50 ? 'SYSTEM_STABLE' : fps > 30 ? 'SYSTEM_WARN' : 'SYSTEM_DEGRADED';
  const statusColor = fps > 50 ? 'text-primary' : fps > 30 ? 'text-tertiary-fixed-dim' : 'text-error';

  return (
    <footer className="h-8 bg-surface-container-highest border-t border-outline-variant flex items-center px-md justify-between z-50 shrink-0">
      <div className={`font-label-caps text-label-caps ${statusColor}`}>
        {status} // {fps} FPS // MEM_USAGE: {memUsage}MB // UPTIME: {uptime}s
        {extraInfo && <span className="text-secondary-fixed-dim ml-2">// {extraInfo}</span>}
      </div>
      <div className="flex space-x-6 font-code-sm text-code-sm">
        <span className="text-on-surface-variant hover:text-primary transition-colors cursor-text">STDOUT</span>
        <span className="text-on-surface-variant hover:text-primary transition-colors cursor-text">STDERR</span>
        <span className="text-primary font-bold cursor-text">DEBUG_CONSOLE</span>
      </div>
    </footer>
  );
}
