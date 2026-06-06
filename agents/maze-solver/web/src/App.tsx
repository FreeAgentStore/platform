import { useState, useEffect, useRef, useCallback } from 'react';
import { generateMaze, solve, createRunner, type Maze, type Strategy, type Pos, type MazeRunner } from './heuristic';

const CELL = 20;
const AI_STEP_MS = 120;

const COLORS = {
  wall: '#1a1a1a',
  open: '#262626',
  player: '#22c55e',
  playerTrail: 'rgba(34,197,94,0.15)',
  ai: '#a855f7',
  aiTrail: 'rgba(168,85,247,0.15)',
  start: '#3b82f6',
  exit: '#ef4444',
  path: 'rgba(168,85,247,0.08)',
};

type GameState = 'ready' | 'playing' | 'won-player' | 'won-ai';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(21);
  const [strategy, setStrategy] = useState<Strategy>('astar');
  const [maze, setMaze] = useState<Maze>(() => generateMaze(21, 21));
  const [gameState, setGameState] = useState<GameState>('ready');
  const [aiSteps, setAiSteps] = useState(0);
  const [playerSteps, setPlayerSteps] = useState(0);

  const playerPos = useRef<Pos>([...maze.start]);
  const playerTrail = useRef<Set<string>>(new Set());
  const aiRunner = useRef<MazeRunner | null>(null);
  const aiInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiTrail = useRef<Set<string>>(new Set());

  const newGame = useCallback((s?: number) => {
    const sz = s ?? size;
    const m = generateMaze(sz, sz);
    setMaze(m);
    setGameState('ready');
    setAiSteps(0);
    setPlayerSteps(0);
    playerPos.current = [...m.start];
    playerTrail.current = new Set([`${m.start[0]},${m.start[1]}`]);
    aiTrail.current = new Set();
    if (aiInterval.current) clearInterval(aiInterval.current);
    aiRunner.current = null;
  }, [size]);

  const startGame = useCallback(() => {
    setGameState('playing');
    const runner = createRunner(maze, strategy);
    aiRunner.current = runner;
    aiTrail.current = new Set([`${maze.start[0]},${maze.start[1]}`]);

    aiInterval.current = setInterval(() => {
      if (!aiRunner.current || aiRunner.current.done) {
        if (aiInterval.current) clearInterval(aiInterval.current);
        if (aiRunner.current?.won) {
          setGameState(prev => prev === 'playing' ? 'won-ai' : prev);
        }
        return;
      }
      aiRunner.current.step();
      const [r, c] = aiRunner.current.pos;
      aiTrail.current.add(`${r},${c}`);
      setAiSteps(aiRunner.current.steps);
    }, AI_STEP_MS);
  }, [maze, strategy]);

  // Player movement
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      const dirMap: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
      };
      const dir = dirMap[e.key];
      if (!dir) return;
      e.preventDefault();

      const [cr, cc] = playerPos.current;
      const nr = cr + dir[0];
      const nc = cc + dir[1];
      if (nr >= 0 && nr < maze.rows && nc >= 0 && nc < maze.cols && maze.grid[nr][nc] === 0) {
        playerPos.current = [nr, nc];
        playerTrail.current.add(`${nr},${nc}`);
        setPlayerSteps(s => s + 1);

        if (nr === maze.exit[0] && nc === maze.exit[1]) {
          setGameState('won-player');
          if (aiInterval.current) clearInterval(aiInterval.current);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, maze]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;

    const draw = () => {
      const w = maze.cols * CELL;
      const h = maze.rows * CELL;
      canvas.width = w;
      canvas.height = h;

      // Grid
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          const k = `${r},${c}`;
          ctx.fillStyle = maze.grid[r][c] === 1 ? COLORS.wall
            : playerTrail.current.has(k) ? COLORS.playerTrail
            : aiTrail.current.has(k) ? COLORS.aiTrail
            : COLORS.open;
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        }
      }

      // Start / Exit
      ctx.fillStyle = COLORS.start;
      ctx.fillRect(maze.start[1] * CELL + 2, maze.start[0] * CELL + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = COLORS.exit;
      ctx.fillRect(maze.exit[1] * CELL + 2, maze.exit[0] * CELL + 2, CELL - 4, CELL - 4);

      // AI position
      if (aiRunner.current) {
        const [ar, ac] = aiRunner.current.pos;
        ctx.fillStyle = COLORS.ai;
        ctx.beginPath();
        ctx.arc(ac * CELL + CELL / 2, ar * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player position
      const [pr, pc] = playerPos.current;
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(pc * CELL + CELL / 2, pr * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [maze, gameState]);

  // Cleanup interval
  useEffect(() => {
    return () => { if (aiInterval.current) clearInterval(aiInterval.current); };
  }, []);

  const result = gameState === 'ready' ? solve(maze, strategy) : null;

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
        <a href="https://freeagentstore.online" className="text-neutral-500 hover:text-neutral-300 text-sm">FreeAgentStore</a>
        <h1 className="font-semibold text-lg" style={{ fontFamily: 'var(--font-serif)' }}>Maze Racer</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">You vs FAGS Agent</span>
      </header>

      <main className="flex-1 flex flex-col items-center p-4 gap-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={size} onChange={e => { setSize(Number(e.target.value)); newGame(Number(e.target.value)); }}
            className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs">
            <option value={11}>11x11</option>
            <option value={15}>15x15</option>
            <option value={21}>21x21</option>
            <option value={31}>31x31</option>
            <option value={41}>41x41</option>
          </select>

          <select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); }}
            className="px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs">
            <option value="astar">A* (optimal)</option>
            <option value="bfs">BFS (optimal, slow)</option>
            <option value="greedy">Greedy (fast, dumb)</option>
            <option value="wall-follower">Wall Follower</option>
            <option value="dead-end-fill">Dead-End Fill</option>
          </select>

          {gameState === 'ready' && (
            <button onClick={startGame}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold">
              Start Race
            </button>
          )}

          <button onClick={() => newGame()}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 text-xs hover:text-neutral-200">
            New Maze
          </button>
        </div>

        {/* Scoreboard */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-neutral-400">You:</span>
            <span className="font-mono text-neutral-200">{playerSteps}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-neutral-400">AI ({strategy}):</span>
            <span className="font-mono text-neutral-200">{aiSteps}</span>
          </div>
          {result && (
            <div className="text-xs text-neutral-600">
              Optimal: {result.path.length - 1} steps, explored {result.explored} cells in {result.timeMs.toFixed(1)}ms
            </div>
          )}
        </div>

        {/* Game result */}
        {gameState === 'won-player' && (
          <div className="px-4 py-2 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-400 text-sm font-semibold">
            You win! {playerSteps} steps vs AI's {aiSteps}
          </div>
        )}
        {gameState === 'won-ai' && (
          <div className="px-4 py-2 rounded-lg bg-violet-950/50 border border-violet-800 text-violet-400 text-sm font-semibold">
            AI wins! AI: {aiSteps} steps, You: {playerSteps} steps
          </div>
        )}

        {/* Canvas */}
        <canvas ref={canvasRef} className="rounded-lg border border-neutral-800" style={{ imageRendering: 'pixelated' }} />

        {gameState === 'ready' && (
          <div className="text-xs text-neutral-600 text-center max-w-md">
            Arrow keys or WASD to move. Race the purple AI to the red exit.
            The AI uses a FAGS heuristic agent — zero model, pure code.
            Try different strategies and maze sizes.
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-neutral-600 py-3 border-t border-neutral-800">
        AI powered by <code className="text-violet-400">@freeagentstore/maze-solver</code> — 5 strategies, zero model, sub-millisecond.
        <br />The same agent code works in any game, any app, any automation.
      </footer>
    </div>
  );
}
