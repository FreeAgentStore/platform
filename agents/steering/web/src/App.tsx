import { useRef, useEffect, useState, useCallback } from 'react';
import {
  type Agent, type Vec2, type Obstacle, type Bounds,
  vec2, add, scale, normalize, mag, dist,
  seek, flee, arrive, wander, pursue, evade, flock,
  avoidObstacles, followPath, constrain, applyForce,
  createAgent, getNeighbors,
} from './steering';

type Scenario = 'flocking' | 'seek-flee' | 'wander' | 'path' | 'obstacles' | 'predator-prey';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'flocking', label: 'Flocking' },
  { id: 'seek-flee', label: 'Seek & Flee' },
  { id: 'wander', label: 'Wander' },
  { id: 'path', label: 'Path Following' },
  { id: 'obstacles', label: 'Obstacle Avoidance' },
  { id: 'predator-prey', label: 'Predator / Prey' },
];

interface SimState {
  agents: Agent[];
  predators: Agent[];
  obstacles: Obstacle[];
  path: Vec2[];
  wanderAngles: number[];
  attractor: Vec2 | null;
}

function initSim(scenario: Scenario, w: number, h: number): SimState {
  const state: SimState = {
    agents: [],
    predators: [],
    obstacles: [],
    path: [],
    wanderAngles: [],
    attractor: null,
  };

  switch (scenario) {
    case 'flocking': {
      for (let i = 0; i < 200; i++) {
        state.agents.push(createAgent(
          Math.random() * w,
          Math.random() * h,
          2.5 + Math.random(),
          0.12,
        ));
      }
      break;
    }
    case 'seek-flee': {
      for (let i = 0; i < 80; i++) {
        const a = createAgent(Math.random() * w, Math.random() * h, 3, 0.15);
        state.agents.push(a);
      }
      break;
    }
    case 'wander': {
      for (let i = 0; i < 60; i++) {
        state.agents.push(createAgent(
          w / 2 + (Math.random() - 0.5) * 200,
          h / 2 + (Math.random() - 0.5) * 200,
          1.5 + Math.random(),
          0.08,
        ));
        state.wanderAngles.push(Math.random() * Math.PI * 2);
      }
      break;
    }
    case 'path': {
      // Default path: a loop
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.3;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        state.path.push(vec2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
      }
      state.path.push({ ...state.path[0] }); // close the loop
      for (let i = 0; i < 40; i++) {
        state.agents.push(createAgent(
          Math.random() * w,
          Math.random() * h,
          2.5,
          0.12,
        ));
      }
      break;
    }
    case 'obstacles': {
      // Place some initial obstacles
      for (let i = 0; i < 6; i++) {
        state.obstacles.push({
          pos: vec2(100 + Math.random() * (w - 200), 100 + Math.random() * (h - 200)),
          radius: 25 + Math.random() * 30,
        });
      }
      for (let i = 0; i < 50; i++) {
        state.agents.push(createAgent(
          Math.random() * w,
          Math.random() * h,
          2.5,
          0.15,
        ));
      }
      break;
    }
    case 'predator-prey': {
      for (let i = 0; i < 80; i++) {
        const a = createAgent(Math.random() * w, Math.random() * h, 2.5, 0.12);
        state.agents.push(a);
      }
      for (let i = 0; i < 4; i++) {
        const p = createAgent(Math.random() * w, Math.random() * h, 3.5, 0.18);
        p.radius = 7;
        state.predators.push(p);
      }
      break;
    }
  }

  return state;
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  vel: Vec2,
  size: number,
  color: string,
) {
  const angle = Math.atan2(vel.y, vel.x);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.6, size * 0.5);
  ctx.lineTo(-size * 0.6, -size * 0.5);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<SimState | null>(null);
  const mouseRef = useRef<Vec2 | null>(null);
  const frameRef = useRef<number>(0);
  const [scenario, setScenario] = useState<Scenario>('flocking');
  const [agentCount, setAgentCount] = useState(200);
  const [maxSpeed, setMaxSpeed] = useState(3.0);
  const [maxForce, setMaxForce] = useState(0.15);

  const sizeRef = useRef({ w: 0, h: 0 });

  const resetSim = useCallback((sc: Scenario) => {
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    simRef.current = initSim(sc, w, h);
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

    resetSim(scenario);

    const ctx = canvas.getContext('2d')!;

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = vec2(e.clientX - rect.left, e.clientY - rect.top);
    };
    const handleLeave = () => { mouseRef.current = null; };
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const pos = vec2(e.clientX - rect.left, e.clientY - rect.top);
      const sim = simRef.current;
      if (!sim) return;

      if (scenario === 'flocking') {
        sim.attractor = pos;
        setTimeout(() => { if (simRef.current) simRef.current.attractor = null; }, 2000);
      } else if (scenario === 'path') {
        // Clicking adds waypoints
        if (sim.path.length > 0 && dist(pos, sim.path[0]) < 20 && sim.path.length > 2) {
          sim.path.push({ ...sim.path[0] }); // close loop
        } else {
          sim.path.push(pos);
        }
      } else if (scenario === 'obstacles') {
        sim.obstacles.push({ pos, radius: 25 + Math.random() * 20 });
      }
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('click', handleClick);

    let running = true;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (!running) return;
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05) * 60; // normalize to ~60fps
      lastTime = now;

      const sim = simRef.current;
      if (!sim) { frameRef.current = requestAnimationFrame(loop); return; }

      const { w, h } = sizeRef.current;
      const bounds: Bounds = { x: 0, y: 0, w, h };
      const mouse = mouseRef.current;

      // Update agent params from sliders
      for (const a of sim.agents) {
        a.maxSpeed = maxSpeed;
        a.maxForce = maxForce;
      }

      // Resize agent count for flocking
      if (scenario === 'flocking') {
        while (sim.agents.length < agentCount) {
          sim.agents.push(createAgent(Math.random() * w, Math.random() * h, maxSpeed, maxForce));
        }
        while (sim.agents.length > agentCount) {
          sim.agents.pop();
        }
      }

      // ── Physics step ──
      switch (scenario) {
        case 'flocking': {
          for (const a of sim.agents) {
            const neighbors = getNeighbors(a, sim.agents, 50);
            let force = flock(a, neighbors, { separate: 1.5, align: 1.0, cohere: 1.0 });
            if (sim.attractor) {
              force = add(force, scale(seek(a, sim.attractor), 0.5));
            }
            force = add(force, constrain(a, bounds));
            applyForce(a, force, dt);
          }
          break;
        }
        case 'seek-flee': {
          if (mouse) {
            for (let i = 0; i < sim.agents.length; i++) {
              const a = sim.agents[i];
              const force = i % 3 === 0
                ? flee(a, mouse, 150)
                : arrive(a, mouse, 100);
              const edge = constrain(a, bounds);
              applyForce(a, add(force, edge), dt);
            }
          } else {
            for (const a of sim.agents) {
              applyForce(a, constrain(a, bounds), dt);
            }
          }
          break;
        }
        case 'wander': {
          for (let i = 0; i < sim.agents.length; i++) {
            const a = sim.agents[i];
            const result = wander(a, 40, 20, sim.wanderAngles[i] ?? 0);
            sim.wanderAngles[i] = result.angle;
            const edge = constrain(a, bounds);
            applyForce(a, add(result.force, edge), dt);
          }
          break;
        }
        case 'path': {
          if (sim.path.length >= 2) {
            for (const a of sim.agents) {
              const force = followPath(a, sim.path, 25);
              const edge = constrain(a, bounds);
              applyForce(a, add(force, edge), dt);
            }
          }
          break;
        }
        case 'obstacles': {
          const target = mouse ?? vec2(w / 2, h / 2);
          for (const a of sim.agents) {
            const seekForce = seek(a, target);
            const avoid = avoidObstacles(a, sim.obstacles, 60);
            const edge = constrain(a, bounds);
            applyForce(a, add(add(seekForce, scale(avoid, 2)), edge), dt);
          }
          break;
        }
        case 'predator-prey': {
          // Prey: flock + evade predators
          for (const prey of sim.agents) {
            const neighbors = getNeighbors(prey, sim.agents, 50);
            let force = flock(prey, neighbors, { separate: 1.5, align: 1.0, cohere: 1.0 });
            for (const pred of sim.predators) {
              if (dist(prey.pos, pred.pos) < 120) {
                force = add(force, scale(evade(prey, pred), 2.0));
              }
            }
            force = add(force, constrain(prey, bounds));
            applyForce(prey, force, dt);
          }
          // Predators: pursue nearest prey
          for (const pred of sim.predators) {
            let nearest: Agent | null = null;
            let nearestD = Infinity;
            for (const prey of sim.agents) {
              const d = dist(pred.pos, prey.pos);
              if (d < nearestD) {
                nearestD = d;
                nearest = prey;
              }
            }
            let force = nearest ? pursue(pred, nearest) : vec2(0, 0);
            force = add(force, constrain(pred, bounds));
            applyForce(pred, force, dt);
          }
          break;
        }
      }

      // ── Render ──
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Draw path
      if (scenario === 'path' && sim.path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(sim.path[0].x, sim.path[0].y);
        for (let i = 1; i < sim.path.length; i++) {
          ctx.lineTo(sim.path[i].x, sim.path[i].y);
        }
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(124, 58, 237, 0.7)';
        ctx.stroke();

        for (const p of sim.path) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(167, 139, 250, 0.8)';
          ctx.fill();
        }
      }

      // Draw obstacles
      for (const obs of sim.obstacles) {
        ctx.beginPath();
        ctx.arc(obs.pos.x, obs.pos.y, obs.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw attractor
      if (sim.attractor) {
        ctx.beginPath();
        ctx.arc(sim.attractor.x, sim.attractor.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(124, 58, 237, 0.5)';
        ctx.fill();
      }

      // Draw agents
      for (let i = 0; i < sim.agents.length; i++) {
        const a = sim.agents[i];
        let color: string;
        if (scenario === 'seek-flee') {
          color = i % 3 === 0 ? '#f87171' : '#60a5fa';
        } else if (scenario === 'predator-prey') {
          color = '#4ade80';
        } else if (scenario === 'wander') {
          const hue = (i / sim.agents.length) * 360;
          color = `hsl(${hue}, 70%, 65%)`;
        } else {
          color = '#a78bfa';
        }
        drawTriangle(ctx, a.pos, a.vel, a.radius + 2, color);
      }

      // Draw predators
      for (const pred of sim.predators) {
        drawTriangle(ctx, pred.pos, pred.vel, pred.radius + 4, '#ef4444');
        // Glow
        ctx.beginPath();
        ctx.arc(pred.pos.x, pred.pos.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fill();
      }

      // Draw mouse indicator
      if (mouse && (scenario === 'seek-flee' || scenario === 'obstacles')) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
      canvas.removeEventListener('click', handleClick);
    };
  }, [scenario, agentCount, maxSpeed, maxForce, resetSim]);

  const switchScenario = useCallback((sc: Scenario) => {
    setScenario(sc);
    // Defaults per scenario
    if (sc === 'flocking') { setAgentCount(200); setMaxSpeed(3.0); setMaxForce(0.15); }
    else if (sc === 'wander') { setAgentCount(60); setMaxSpeed(2.0); setMaxForce(0.08); }
    else if (sc === 'predator-prey') { setAgentCount(80); setMaxSpeed(2.5); setMaxForce(0.12); }
    else { setAgentCount(50); setMaxSpeed(3.0); setMaxForce(0.15); }
  }, []);

  const hint = (() => {
    switch (scenario) {
      case 'flocking': return 'Click to place a temporary attractor.';
      case 'seek-flee': return 'Move mouse: blue agents seek, red agents flee.';
      case 'wander': return 'Watch agents wander with emergent paths.';
      case 'path': return 'Click to place waypoints. Click near first point to close loop.';
      case 'obstacles': return 'Agents seek mouse. Click to place obstacles.';
      case 'predator-prey': return 'Red predators pursue green prey. Prey flocks and evades.';
    }
  })();

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">
          FreeAgentStore
        </a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>
          Steering Behaviors
        </h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
          {simRef.current?.agents.length ?? 0} agents
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
        {scenario === 'flocking' && (
          <label className="flex items-center gap-2">
            Agents: {agentCount}
            <input
              type="range"
              min={20}
              max={500}
              value={agentCount}
              onChange={(e) => setAgentCount(Number(e.target.value))}
              className="w-24 accent-violet-500"
            />
          </label>
        )}
        <label className="flex items-center gap-2">
          Speed: {maxSpeed.toFixed(1)}
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={maxSpeed}
            onChange={(e) => setMaxSpeed(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
        <label className="flex items-center gap-2">
          Force: {maxForce.toFixed(2)}
          <input
            type="range"
            min={0.02}
            max={0.5}
            step={0.01}
            value={maxForce}
            onChange={(e) => setMaxForce(Number(e.target.value))}
            className="w-24 accent-violet-500"
          />
        </label>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        Craig Reynolds' steering behaviors. Pure math, zero model, 60fps. Runs in your browser.
      </footer>
    </div>
  );
}
