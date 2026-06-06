import { describe, it, expect } from 'vitest';
import { solve, createRunner, generateMaze, type Maze, type Strategy, type Cell } from './heuristic';

/** Small 5x5 maze for testing. */
function smallMaze(): Maze {
  // 0=open 1=wall
  // S . . . .
  // 1 1 1 1 .
  // . . . . .
  // . 1 1 1 1
  // . . . . E
  const grid: Cell[][] = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
  ];
  return { grid, rows: 5, cols: 5, start: [0, 0], exit: [4, 4] };
}

/** Trivial 3x3 maze — straight line. */
function trivialMaze(): Maze {
  const grid: Cell[][] = [
    [0, 0, 0],
    [1, 1, 0],
    [0, 0, 0],
  ];
  return { grid, rows: 3, cols: 3, start: [0, 0], exit: [2, 2] };
}

/** Impossible maze — no path. */
function impossibleMaze(): Maze {
  const grid: Cell[][] = [
    [0, 1, 0],
    [1, 1, 0],
    [0, 0, 0],
  ];
  return { grid, rows: 3, cols: 3, start: [0, 0], exit: [2, 2] };
}

const ALL_STRATEGIES: Strategy[] = ['bfs', 'astar', 'wall-follower', 'dead-end-fill', 'greedy'];

describe('solve', () => {
  it('solves a small maze with all strategies', () => {
    const maze = smallMaze();
    for (const strategy of ALL_STRATEGIES) {
      const r = solve(maze, strategy);
      expect(r.solved, `${strategy} should solve`).toBe(true);
      expect(r.path.length).toBeGreaterThan(0);
      expect(r.path[0]).toEqual([0, 0]);
      expect(r.path[r.path.length - 1]).toEqual([4, 4]);
      expect(r.strategy).toBe(strategy);
      expect(r.timeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('solves trivial maze', () => {
    const maze = trivialMaze();
    const r = solve(maze, 'astar');
    expect(r.solved).toBe(true);
    expect(r.path[0]).toEqual([0, 0]);
    expect(r.path[r.path.length - 1]).toEqual([2, 2]);
  });

  it('returns empty path for impossible maze', () => {
    const maze = impossibleMaze();
    for (const strategy of ['bfs', 'astar'] as Strategy[]) {
      const r = solve(maze, strategy);
      expect(r.solved, `${strategy}`).toBe(false);
      expect(r.path).toHaveLength(0);
    }
  });

  it('path only goes through open cells', () => {
    const maze = smallMaze();
    const r = solve(maze, 'astar');
    for (const [row, col] of r.path) {
      expect(maze.grid[row][col], `[${row},${col}] should be open`).toBe(0);
    }
  });

  it('path steps are adjacent (no teleporting)', () => {
    const maze = smallMaze();
    const r = solve(maze, 'bfs');
    for (let i = 1; i < r.path.length; i++) {
      const [pr, pc] = r.path[i - 1];
      const [cr, cc] = r.path[i];
      const dist = Math.abs(cr - pr) + Math.abs(cc - pc);
      expect(dist, `step ${i}: [${pr},${pc}]->[${cr},${cc}]`).toBe(1);
    }
  });

  it('BFS and A* find optimal path (same length)', () => {
    const maze = smallMaze();
    const bfs = solve(maze, 'bfs');
    const astar = solve(maze, 'astar');
    expect(bfs.path.length).toBe(astar.path.length);
  });

  it('A* explores fewer cells than BFS', () => {
    const maze = generateMaze(21, 21, 42);
    const bfs = solve(maze, 'bfs');
    const astar = solve(maze, 'astar');
    expect(astar.explored).toBeLessThanOrEqual(bfs.explored);
  });

  it('reports explored count', () => {
    const maze = smallMaze();
    const r = solve(maze, 'astar');
    expect(r.explored).toBeGreaterThan(0);
  });
});

describe('createRunner', () => {
  it('steps through the maze one cell at a time', () => {
    const maze = smallMaze();
    const runner = createRunner(maze, 'astar');
    expect(runner.done).toBe(false);
    expect(runner.steps).toBe(0);

    let stepCount = 0;
    while (!runner.done) {
      const dir = runner.step();
      expect(dir).toBeTruthy();
      expect(['up', 'down', 'left', 'right']).toContain(dir);
      stepCount++;
      if (stepCount > 100) break; // safety
    }

    expect(runner.done).toBe(true);
    expect(runner.won).toBe(true);
    expect(runner.steps).toBeGreaterThan(0);
  });

  it('returns null when already done', () => {
    const maze = trivialMaze();
    const runner = createRunner(maze, 'bfs');
    while (!runner.done) runner.step();
    expect(runner.step()).toBeNull();
  });

  it('tracks position correctly', () => {
    const maze = smallMaze();
    const runner = createRunner(maze, 'astar');
    expect(runner.pos).toEqual([0, 0]);
    runner.step();
    // Should have moved to an adjacent cell
    const [r, c] = runner.pos;
    const dist = Math.abs(r) + Math.abs(c);
    expect(dist).toBe(1);
  });
});

describe('generateMaze', () => {
  it('generates a solvable maze', () => {
    const maze = generateMaze(15, 15, 123);
    const r = solve(maze, 'bfs');
    expect(r.solved).toBe(true);
  });

  it('generates different mazes with different seeds', () => {
    const a = generateMaze(11, 11, 1);
    const b = generateMaze(11, 11, 2);
    // Grids should differ
    const gridA = a.grid.flat().join('');
    const gridB = b.grid.flat().join('');
    expect(gridA).not.toBe(gridB);
  });

  it('has correct dimensions', () => {
    const maze = generateMaze(15, 21, 0);
    expect(maze.rows).toBe(15);
    expect(maze.cols).toBe(21);
    expect(maze.grid.length).toBe(15);
    expect(maze.grid[0].length).toBe(21);
  });

  it('start and exit are open', () => {
    const maze = generateMaze(11, 11, 99);
    expect(maze.grid[maze.start[0]][maze.start[1]]).toBe(0);
    expect(maze.grid[maze.exit[0]][maze.exit[1]]).toBe(0);
  });

  it('outer edges are walls (except start/exit)', () => {
    const maze = generateMaze(11, 11, 42);
    for (let c = 0; c < maze.cols; c++) {
      if (!(maze.start[0] === 0 && maze.start[1] === c) && !(maze.exit[0] === 0 && maze.exit[1] === c)) {
        expect(maze.grid[0][c], `top edge [0,${c}]`).toBe(1);
      }
      if (!(maze.start[0] === maze.rows - 1 && maze.start[1] === c) && !(maze.exit[0] === maze.rows - 1 && maze.exit[1] === c)) {
        expect(maze.grid[maze.rows - 1][c], `bottom edge [${maze.rows - 1},${c}]`).toBe(1);
      }
    }
  });

  it('generates large mazes quickly', () => {
    const start = performance.now();
    const maze = generateMaze(51, 51, 7);
    const genTime = performance.now() - start;
    expect(genTime).toBeLessThan(100);

    const solveStart = performance.now();
    const r = solve(maze, 'astar');
    const solveTime = performance.now() - solveStart;
    expect(r.solved).toBe(true);
    expect(solveTime).toBeLessThan(100);
  });
});
