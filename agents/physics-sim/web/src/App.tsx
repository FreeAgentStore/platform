import { useRef, useEffect, useState, useCallback } from 'react';
import {
  type PhysicsWorld, type Vec2, type Bounds,
  createWorld, createParticle, addParticle,
  createCloth, createRope, createSoftBody, createRagdoll,
  step, applyExplosion, findNearest, tearAt,
} from './physics';

type Scenario = 'cloth' | 'rope' | 'soft-body' | 'ragdoll' | 'rain' | 'explosion';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'cloth', label: 'Cloth' },
  { id: 'rope', label: 'Rope' },
  { id: 'soft-body', label: 'Soft Body' },
  { id: 'ragdoll', label: 'Ragdoll' },
  { id: 'rain', label: 'Particle Rain' },
  { id: 'explosion', label: 'Explosion' },
];

function initWorld(scenario: Scenario, w: number, h: number): PhysicsWorld {
  const world = createWorld();

  switch (scenario) {
    case 'cloth': {
      const cols = 30;
      const rows = 20;
      const spacing = Math.min((w - 80) / cols, 12);
      const startX = (w - cols * spacing) / 2;
      createCloth(world, startX, 40, cols, rows, spacing, true, true);
      break;
    }
    case 'rope': {
      // Multiple ropes pinned at different positions
      for (let i = 0; i < 5; i++) {
        const rx = 100 + i * ((w - 200) / 4);
        createRope(world, rx, 30, 200 + i * 30, 15 + i * 3, true);
      }
      break;
    }
    case 'soft-body': {
      // Multiple soft bodies at different heights
      for (let i = 0; i < 4; i++) {
        createSoftBody(
          world,
          120 + i * ((w - 240) / 3),
          80 + i * 30,
          25 + Math.random() * 15,
          12,
        );
      }
      break;
    }
    case 'ragdoll': {
      // Two ragdolls
      createRagdoll(world, w * 0.35, 60);
      createRagdoll(world, w * 0.65, 80);
      break;
    }
    case 'rain': {
      // Platforms (static pinned particles forming lines)
      const platforms = [
        { x: w * 0.2, y: h * 0.4, len: 120 },
        { x: w * 0.6, y: h * 0.3, len: 100 },
        { x: w * 0.4, y: h * 0.6, len: 140 },
        { x: w * 0.75, y: h * 0.55, len: 90 },
      ];
      for (const plat of platforms) {
        const segs = Math.floor(plat.len / 8);
        for (let i = 0; i <= segs; i++) {
          addParticle(world, createParticle(
            plat.x + (i / segs) * plat.len - plat.len / 2,
            plat.y,
            100,
            true,
            4,
          ));
        }
      }
      break;
    }
    case 'explosion': {
      // Grid of particles
      const spacing = 15;
      const cols = Math.floor((w - 60) / spacing);
      const rows = Math.floor((h - 160) / spacing);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          addParticle(world, createParticle(
            30 + c * spacing + (Math.random() - 0.5) * 2,
            80 + r * spacing + (Math.random() - 0.5) * 2,
            1,
            false,
            2,
          ));
        }
      }
      break;
    }
  }

  return world;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<PhysicsWorld>(createWorld());
  const frameRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });
  const mouseRef = useRef<{ x: number; y: number; down: boolean; dragging: number }>({
    x: 0, y: 0, down: false, dragging: -1,
  });
  const rainTimerRef = useRef(0);

  const [scenario, setScenario] = useState<Scenario>('cloth');
  const [gravity, setGravity] = useState(500);
  const [stiffness, setStiffness] = useState(0.9);
  const [iterations, setIterations] = useState(5);
  const [damping, setDamping] = useState(0.99);

  const gravityRef = useRef(gravity);
  const stiffnessRef = useRef(stiffness);
  const iterationsRef = useRef(iterations);
  const dampingRef = useRef(damping);
  const scenarioRef = useRef(scenario);

  useEffect(() => { gravityRef.current = gravity; }, [gravity]);
  useEffect(() => { stiffnessRef.current = stiffness; }, [stiffness]);
  useEffect(() => { iterationsRef.current = iterations; }, [iterations]);
  useEffect(() => { dampingRef.current = damping; }, [damping]);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);

  const resetWorld = useCallback((sc: Scenario) => {
    const { w, h } = sizeRef.current;
    if (w === 0) return;
    worldRef.current = initWorld(sc, w, h);
    setScenario(sc);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement!;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);

    // Init world after sizing
    worldRef.current = initWorld(scenario, canvas.width, canvas.height);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current.down = true;
      mouseRef.current.x = x;
      mouseRef.current.y = y;

      const sc = scenarioRef.current;

      if (sc === 'cloth') {
        // Right-click or Shift+click to tear
        if (e.shiftKey || e.button === 2) {
          tearAt(worldRef.current, x, y, 20);
          return;
        }
      }

      if (sc === 'explosion') {
        applyExplosion(worldRef.current.particles, { x, y }, 15, 200);
        return;
      }

      // Default: find nearest to drag
      const idx = findNearest(worldRef.current, x, y, 30);
      mouseRef.current.dragging = idx;
    };
    const handleMouseUp = () => {
      mouseRef.current.down = false;
      mouseRef.current.dragging = -1;
    };
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
      const me = e as MouseEvent;
      const rect = canvas.getBoundingClientRect();
      tearAt(worldRef.current, me.clientX - rect.left, me.clientY - rect.top, 20);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    let running = true;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!running) return;
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.033); // cap at ~30fps min
      lastTime = now;

      const world = worldRef.current;
      const { w, h } = sizeRef.current;
      const bounds: Bounds = { x: 0, y: 0, w, h };
      const grav: Vec2 = { x: 0, y: gravityRef.current };

      // Rain: spawn particles
      if (scenarioRef.current === 'rain') {
        rainTimerRef.current += dt;
        while (rainTimerRef.current > 0.02) {
          rainTimerRef.current -= 0.02;
          if (world.particles.length < 2000) {
            const p = createParticle(
              30 + Math.random() * (w - 60),
              -5,
              0.5 + Math.random() * 0.5,
              false,
              1.5 + Math.random() * 1.5,
            );
            addParticle(world, p);
          }
        }
        // Remove particles that fell off-screen
        for (let i = world.particles.length - 1; i >= 0; i--) {
          if (!world.particles[i].pinned && world.particles[i].pos.y > h + 20) {
            world.particles.splice(i, 1);
          }
        }
      }

      // Drag interaction
      const mouse = mouseRef.current;
      if (mouse.down && mouse.dragging >= 0) {
        const p = world.particles[mouse.dragging];
        if (p) {
          p.pos.x = mouse.x;
          p.pos.y = mouse.y;
          p.prev.x = mouse.x;
          p.prev.y = mouse.y;
        }
      }

      // Cloth tearing while dragging with shift
      if (mouse.down && scenarioRef.current === 'cloth' && mouse.dragging < 0) {
        tearAt(world, mouse.x, mouse.y, 12);
      }

      // Update stiffness on constraints
      for (const c of world.constraints) {
        if (!c.broken) c.stiffness = stiffnessRef.current;
      }

      // Physics step
      step(world, dt, grav, iterationsRef.current, bounds, dampingRef.current);

      // Rain: particle-platform collision (bounce off pinned particles)
      if (scenarioRef.current === 'rain') {
        for (const p of world.particles) {
          if (p.pinned) continue;
          for (const plat of world.particles) {
            if (!plat.pinned) continue;
            const dx = p.pos.x - plat.pos.x;
            const dy = p.pos.y - plat.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = p.radius + plat.radius;
            if (dist < minDist && dist > 0) {
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;
              p.pos.x += nx * overlap;
              p.pos.y += ny * overlap;
              // Bounce: reflect velocity
              const vx = p.pos.x - p.prev.x;
              const vy = p.pos.y - p.prev.y;
              const dotV = vx * nx + vy * ny;
              p.prev.x = p.pos.x - (vx - 2 * dotV * nx) * 0.3;
              p.prev.y = p.pos.y - (vy - 2 * dotV * ny) * 0.3;
            }
          }
        }
      }

      // ── Render ──
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Draw constraints
      for (const c of world.constraints) {
        if (c.broken) continue;
        const pa = world.particles[c.a];
        const pb = world.particles[c.b];
        ctx.beginPath();
        ctx.moveTo(pa.pos.x, pa.pos.y);
        ctx.lineTo(pb.pos.x, pb.pos.y);

        // Stretch coloring
        const dx = pb.pos.x - pa.pos.x;
        const dy = pb.pos.y - pa.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const stretch = Math.abs(dist - c.restLength) / c.restLength;
        if (stretch > 0.3) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(1, 0.4 + stretch)})`;
        } else {
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
        }
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw particles
      for (const p of world.particles) {
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);

        if (p.pinned) {
          ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
        } else if (scenarioRef.current === 'rain') {
          ctx.fillStyle = 'rgba(96, 165, 250, 0.7)';
        } else if (scenarioRef.current === 'explosion') {
          // Color based on velocity
          const vx = p.pos.x - p.prev.x;
          const vy = p.pos.y - p.prev.y;
          const speed = Math.sqrt(vx * vx + vy * vy);
          const t = Math.min(1, speed / 10);
          const r = Math.round(167 + t * 88);
          const g = Math.round(139 - t * 70);
          const b = Math.round(250 - t * 182);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = 'rgba(167, 139, 250, 0.8)';
        }
        ctx.fill();

        // Subtle glow for ragdoll head (large radius)
        if (p.radius >= 5 && !p.pinned) {
          ctx.beginPath();
          ctx.arc(p.pos.x, p.pos.y, p.radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(167, 139, 250, 0.1)';
          ctx.fill();
        }
      }

      // Draw floor line
      ctx.beginPath();
      ctx.moveTo(0, h - 1);
      ctx.lineTo(w, h - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [scenario, resetWorld]);

  const switchScenario = useCallback((sc: Scenario) => {
    resetWorld(sc);
    // Defaults per scenario
    if (sc === 'cloth') { setGravity(500); setStiffness(0.9); setIterations(5); setDamping(0.99); }
    else if (sc === 'rope') { setGravity(600); setStiffness(1.0); setIterations(8); setDamping(0.99); }
    else if (sc === 'soft-body') { setGravity(400); setStiffness(0.8); setIterations(6); setDamping(0.98); }
    else if (sc === 'ragdoll') { setGravity(500); setStiffness(0.9); setIterations(8); setDamping(0.99); }
    else if (sc === 'rain') { setGravity(300); setStiffness(1.0); setIterations(3); setDamping(0.99); }
    else if (sc === 'explosion') { setGravity(200); setStiffness(1.0); setIterations(3); setDamping(0.995); }
  }, [resetWorld]);

  const hint = (() => {
    switch (scenario) {
      case 'cloth': return 'Click-drag to pull. Right-click or Shift+drag to tear.';
      case 'rope': return 'Click-drag the free end of any rope.';
      case 'soft-body': return 'Click-drag to toss soft bodies around.';
      case 'ragdoll': return 'Click-drag any body part to toss the ragdoll.';
      case 'rain': return 'Watch particles rain down and bounce off platforms.';
      case 'explosion': return 'Click anywhere to create an explosion!';
    }
  })();

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Physics Simulation
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          {worldRef.current.particles.length} particles
        </span>
      </header>

      {/* Scenario selector */}
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => switchScenario(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              scenario === s.id
                ? 'bg-violet-600 text-white'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-neutral-500 px-4 pt-2">{hint}</p>

      {/* Sliders */}
      <div className="flex flex-wrap gap-4 px-4 pt-2 pb-2 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          Gravity: {gravity}
          <input
            type="range"
            min={0}
            max={1200}
            step={10}
            value={gravity}
            onChange={(e) => setGravity(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
        <label className="flex items-center gap-2">
          Stiffness: {stiffness.toFixed(2)}
          <input
            type="range"
            min={0.1}
            max={1.0}
            step={0.05}
            value={stiffness}
            onChange={(e) => setStiffness(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
        <label className="flex items-center gap-2">
          Iterations: {iterations}
          <input
            type="range"
            min={1}
            max={20}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
        <label className="flex items-center gap-2">
          Damping: {damping.toFixed(3)}
          <input
            type="range"
            min={0.9}
            max={1.0}
            step={0.005}
            value={damping}
            onChange={(e) => setDamping(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Verlet integration physics. Pure math, zero model, 60fps. Runs in your browser.
      </footer>
    </div>
  );
}
