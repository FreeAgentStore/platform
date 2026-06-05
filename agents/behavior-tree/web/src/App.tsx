import { useRef, useEffect, useState, useCallback } from 'react';
import { type Blackboard, type FlatNode, flattenTree } from './bt';
import { PRESETS, type Preset } from './presets';

type Speed = 0 | 0.5 | 1 | 2;

const STATUS_COLORS: Record<string, string> = {
  success: '#4ade80',
  failure: '#f87171',
  running: '#facc15',
  idle: '#525252',
};

const NPC_STATE_COLORS: Record<string, string> = {
  idle: '#a78bfa',
  walking: '#60a5fa',
  attack: '#ef4444',
  hiding: '#6b7280',
  nervous: '#f59e0b',
  wave: '#34d399',
  pickup: '#fbbf24',
  deposit: '#818cf8',
  healing: '#4ade80',
  aoe: '#f87171',
  slam: '#fb923c',
  cast: '#c084fc',
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [bb, setBB] = useState<Blackboard>({});
  const [flatNodes, setFlatNodes] = useState<FlatNode[]>([]);
  const presetRef = useRef<Preset>(PRESETS[0]);
  const bbRef = useRef<Blackboard>({});
  const speedRef = useRef<Speed>(1);

  const loadPreset = useCallback((idx: number) => {
    const p = PRESETS[idx];
    // Re-create a fresh preset to reset tree state
    const fresh = PRESETS[idx];
    fresh.tree.reset();
    const newBB = p.initBB();
    presetRef.current = fresh;
    bbRef.current = newBB;
    setBB({ ...newBB });
    setFlatNodes(flattenTree(fresh.tree));
    setPresetIdx(idx);
  }, []);

  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    loadPreset(0);
  }, [loadPreset]);

  // Canvas for the 2D top-down NPC view
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const b = bbRef.current;
      if (b.player) {
        b.player = { x, y };
      }
    };
    canvas.addEventListener('mousemove', handleMove);

    let running = true;
    let lastTime = performance.now();
    let tickAccum = 0;

    const loop = (now: number) => {
      if (!running) return;
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const sp = speedRef.current;

      if (sp > 0) {
        tickAccum += rawDt * sp;
        const tickDt = 1 / 60;
        while (tickAccum >= tickDt) {
          tickAccum -= tickDt;
          const preset = presetRef.current;
          preset.tree.tick(bbRef.current, tickDt);
        }
      }

      // Update React state at 15fps to avoid unnecessary renders
      if (Math.floor(now / 66) !== Math.floor((now - rawDt * 1000) / 66)) {
        setBB({ ...bbRef.current });
        setFlatNodes(flattenTree(presetRef.current.tree));
      }

      // Render
      const ctx = canvas.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      const b = bbRef.current;
      const preset = presetRef.current;

      // Draw waypoints
      for (let i = 0; i < preset.waypoints.length; i++) {
        const wp = preset.waypoints[i];
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
        ctx.fill();
        ctx.fillStyle = 'rgba(167, 139, 250, 0.7)';
        ctx.font = '10px Manrope, sans-serif';
        ctx.fillText(`W${i + 1}`, wp.x - 8, wp.y - 12);
      }

      // Draw storage
      if (preset.storage) {
        const s = preset.storage;
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fillRect(s.x - 20, s.y - 20, 40, 40);
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x - 20, s.y - 20, 40, 40);
        ctx.fillStyle = 'rgba(165, 180, 252, 0.7)';
        ctx.font = '10px Manrope, sans-serif';
        ctx.fillText('Storage', s.x - 18, s.y - 24);
      }

      // Draw items
      const items = b._items as { x: number; y: number; id: string; taken: boolean }[] | undefined;
      if (items) {
        for (const item of items) {
          if (item.taken) continue;
          ctx.beginPath();
          // Diamond shape
          ctx.moveTo(item.x, item.y - 8);
          ctx.lineTo(item.x + 6, item.y);
          ctx.lineTo(item.x, item.y + 8);
          ctx.lineTo(item.x - 6, item.y);
          ctx.closePath();
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Draw friends
      for (const f of preset.friends) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#6ee7b7';
        ctx.font = '10px Manrope, sans-serif';
        ctx.fillText(f.id, f.x - 12, f.y - 14);
      }

      // Draw player (mouse)
      if (b.player && b.player.x > 0) {
        ctx.beginPath();
        ctx.arc(b.player.x, b.player.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(250, 250, 250, 0.08)';
        ctx.fill();
        ctx.fillStyle = 'rgba(250, 250, 250, 0.5)';
        ctx.font = '10px Manrope, sans-serif';
        ctx.fillText('Player', b.player.x - 16, b.player.y - 14);
      }

      // Draw NPC
      const nx = b.npcX ?? 200;
      const ny = b.npcY ?? 200;
      const state = b.npcState ?? 'idle';
      const color = NPC_STATE_COLORS[state] ?? '#a78bfa';

      // Glow
      ctx.beginPath();
      ctx.arc(nx, ny, 20, 0, Math.PI * 2);
      ctx.fillStyle = color + '15';
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(nx, ny, 10, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // State label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px Manrope, sans-serif';
      ctx.fillText(state, nx - 14, ny + 24);

      // HP bar for Boss preset
      if (b.hp !== undefined) {
        const barW = 40;
        const barH = 4;
        const barX = nx - barW / 2;
        const barY = ny - 20;
        ctx.fillStyle = '#1f1f1f';
        ctx.fillRect(barX, barY, barW, barH);
        const hpFrac = Math.max(0, Math.min(1, (b.hp ?? 100) / 100));
        const hpColor = hpFrac > 0.5 ? '#4ade80' : hpFrac > 0.25 ? '#facc15' : '#ef4444';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpFrac, barH);
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMove);
    };
  }, []);

  const step = useCallback(() => {
    const preset = presetRef.current;
    preset.tree.tick(bbRef.current, 1 / 60);
    setBB({ ...bbRef.current });
    setFlatNodes(flattenTree(preset.tree));
  }, []);

  // Blackboard entries to show (filter internals)
  const bbEntries = Object.entries(bb).filter(([k]) => !k.startsWith('_'));

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Behavior Trees
        </h1>
      </header>

      {/* Preset selector */}
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => loadPreset(i)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              presetIdx === i
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Speed controls */}
      <div className="flex items-center gap-2 px-4 pt-2 text-xs text-neutral-400">
        <span>Speed:</span>
        {([0, 0.5, 1, 2] as Speed[]).map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              speed === s
                ? 'bg-neutral-700 text-neutral-100'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {s === 0 ? 'Pause' : `${s}x`}
          </button>
        ))}
        <button
          onClick={step}
          className="px-2 py-1 rounded text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Step
        </button>
        <button
          onClick={() => loadPreset(presetIdx)}
          className="px-2 py-1 rounded text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Reset
        </button>
        <span className="ml-2 text-neutral-600">{PRESETS[presetIdx].description}</span>
      </div>

      {/* Main content: tree viewer + canvas */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Tree visualizer */}
        <div className="w-72 border-r border-neutral-800 overflow-y-auto p-3 shrink-0">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Tree</h2>
          <div className="space-y-0.5 font-mono text-xs">
            {flatNodes.map((fn, i) => {
              const n = fn.node;
              const statusColor = STATUS_COLORS[n.lastStatus] ?? STATUS_COLORS.idle;
              const isComposite = n.type === 'sequence' || n.type === 'selector' || n.type === 'parallel';
              const icon = n.type === 'sequence' ? '->' : n.type === 'selector' ? '?' : n.type === 'parallel' ? '||' : isComposite ? '+' : '';
              return (
                <div
                  key={i}
                  className="flex items-center gap-1"
                  style={{ paddingLeft: fn.depth * 16 }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor }}
                  />
                  {icon && <span className="text-neutral-600">{icon}</span>}
                  <span className={n.lastStatus === 'running' ? 'text-yellow-300' : 'text-neutral-400'}>
                    {n.name}
                  </span>
                  <span className="text-neutral-700 ml-auto">{n.type}</span>
                </div>
              );
            })}
          </div>

          {/* Blackboard */}
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mt-4 mb-2">Blackboard</h2>
          <div className="space-y-0.5 font-mono text-xs">
            {bbEntries.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-violet-400 shrink-0">{k}:</span>
                <span className="text-neutral-400 truncate">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>

          {/* Log */}
          {bb._log && (
            <>
              <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mt-4 mb-2">Log</h2>
              <div className="space-y-0.5 font-mono text-xs text-neutral-500 max-h-32 overflow-y-auto">
                {(bb._log as string[]).slice(-10).reverse().map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute top-2 right-2 text-xs text-neutral-600">
            Move mouse = player position
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Composable behavior trees for game NPC AI. Pure JS, zero deps, 60fps. Runs in your browser.
      </footer>
    </div>
  );
}
