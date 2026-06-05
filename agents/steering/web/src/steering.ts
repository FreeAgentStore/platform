/**
 * Steering Behaviors — pure math, zero DOM/React dependencies.
 * Implements Craig Reynolds' classic steering behaviors for autonomous agents.
 * Can be imported as an ESM library by FGS games.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Agent {
  pos: Vec2;
  vel: Vec2;
  maxSpeed: number;
  maxForce: number;
  mass: number;
  radius: number;
}

export interface Obstacle {
  pos: Vec2;
  radius: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Vec2 helpers ─────────────────────────────────────────────────────

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function mag(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function magSq(v: Vec2): number {
  return v.x * v.x + v.y * v.y;
}

export function normalize(v: Vec2): Vec2 {
  const m = mag(v);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

export function limit(v: Vec2, max: number): Vec2 {
  const sq = magSq(v);
  if (sq > max * max) {
    const m = Math.sqrt(sq);
    return { x: (v.x / m) * max, y: (v.y / m) * max };
  }
  return v;
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

// ── Steering behaviors ──────────────────────────────────────────────

/**
 * Seek — steer toward target at max speed.
 */
export function seek(agent: Agent, target: Vec2): Vec2 {
  const desired = normalize(sub(target, agent.pos));
  const desiredVel = scale(desired, agent.maxSpeed);
  const steer = sub(desiredVel, agent.vel);
  return limit(steer, agent.maxForce);
}

/**
 * Flee — steer away from target. Only activates within range (default Infinity).
 */
export function flee(agent: Agent, target: Vec2, range: number = Infinity): Vec2 {
  const d = dist(agent.pos, target);
  if (d > range) return vec2(0, 0);
  const desired = normalize(sub(agent.pos, target));
  const desiredVel = scale(desired, agent.maxSpeed);
  const steer = sub(desiredVel, agent.vel);
  return limit(steer, agent.maxForce);
}

/**
 * Arrive — like seek but decelerates smoothly near target.
 */
export function arrive(agent: Agent, target: Vec2, slowRadius: number): Vec2 {
  const toTarget = sub(target, agent.pos);
  const d = mag(toTarget);
  if (d < 0.1) return vec2(0, 0);

  let speed = agent.maxSpeed;
  if (d < slowRadius) {
    speed = agent.maxSpeed * (d / slowRadius);
  }
  const desired = scale(normalize(toTarget), speed);
  const steer = sub(desired, agent.vel);
  return limit(steer, agent.maxForce);
}

/**
 * Wander — jitter a point on a circle projected ahead of the agent.
 * Returns the steering force and the updated wander angle.
 */
export function wander(
  agent: Agent,
  wanderDistance: number,
  wanderRadius: number,
  wanderAngle: number,
): { force: Vec2; angle: number } {
  const jitter = (Math.random() - 0.5) * 0.5;
  const newAngle = wanderAngle + jitter;

  const circleCenter = mag(agent.vel) > 0.001
    ? scale(normalize(agent.vel), wanderDistance)
    : { x: wanderDistance, y: 0 };

  const offset: Vec2 = {
    x: Math.cos(newAngle) * wanderRadius,
    y: Math.sin(newAngle) * wanderRadius,
  };

  const target = add(add(agent.pos, circleCenter), offset);
  return { force: seek(agent, target), angle: newAngle };
}

/**
 * Pursue — predict where a moving target will be and seek that point.
 */
export function pursue(agent: Agent, target: Agent): Vec2 {
  const toTarget = sub(target.pos, agent.pos);
  const d = mag(toTarget);
  const speed = mag(agent.vel);
  const prediction = speed > 0.001 ? d / speed : 1;
  const futurePos = add(target.pos, scale(target.vel, Math.min(prediction, 30)));
  return seek(agent, futurePos);
}

/**
 * Evade — predict where a pursuer will be and flee that point.
 */
export function evade(agent: Agent, pursuer: Agent): Vec2 {
  const toPursuer = sub(pursuer.pos, agent.pos);
  const d = mag(toPursuer);
  const speed = mag(agent.vel);
  const prediction = speed > 0.001 ? d / speed : 1;
  const futurePos = add(pursuer.pos, scale(pursuer.vel, Math.min(prediction, 30)));
  return flee(agent, futurePos);
}

/**
 * Separate — steer away from neighbors that are too close.
 */
export function separate(agent: Agent, neighbors: Agent[], desiredSep: number): Vec2 {
  let steer = vec2(0, 0);
  let count = 0;
  for (const other of neighbors) {
    const d = dist(agent.pos, other.pos);
    if (d > 0 && d < desiredSep) {
      const diff = normalize(sub(agent.pos, other.pos));
      steer = add(steer, scale(diff, 1 / d));
      count++;
    }
  }
  if (count > 0) {
    steer = scale(steer, 1 / count);
    steer = scale(normalize(steer), agent.maxSpeed);
    steer = sub(steer, agent.vel);
    steer = limit(steer, agent.maxForce);
  }
  return steer;
}

/**
 * Align — steer toward the average heading of neighbors.
 */
export function align(agent: Agent, neighbors: Agent[]): Vec2 {
  if (neighbors.length === 0) return vec2(0, 0);
  let avg = vec2(0, 0);
  for (const other of neighbors) {
    avg = add(avg, other.vel);
  }
  avg = scale(avg, 1 / neighbors.length);
  avg = scale(normalize(avg), agent.maxSpeed);
  const steer = sub(avg, agent.vel);
  return limit(steer, agent.maxForce);
}

/**
 * Cohere — steer toward the center of mass of neighbors.
 */
export function cohere(agent: Agent, neighbors: Agent[]): Vec2 {
  if (neighbors.length === 0) return vec2(0, 0);
  let center = vec2(0, 0);
  for (const other of neighbors) {
    center = add(center, other.pos);
  }
  center = scale(center, 1 / neighbors.length);
  return seek(agent, center);
}

/**
 * Flock — combined separation + alignment + cohesion with configurable weights.
 */
export function flock(
  agent: Agent,
  neighbors: Agent[],
  weights: { separate: number; align: number; cohere: number } = { separate: 1.5, align: 1.0, cohere: 1.0 },
): Vec2 {
  const sep = scale(separate(agent, neighbors, agent.radius * 4), weights.separate);
  const ali = scale(align(agent, neighbors), weights.align);
  const coh = scale(cohere(agent, neighbors), weights.cohere);
  return add(add(sep, ali), coh);
}

/**
 * Avoid obstacles — cast a look-ahead ray and steer away from obstacles in the path.
 */
export function avoidObstacles(
  agent: Agent,
  obstacles: Obstacle[],
  lookAhead: number,
): Vec2 {
  const speed = mag(agent.vel);
  if (speed < 0.001) return vec2(0, 0);

  const ahead = add(agent.pos, scale(normalize(agent.vel), lookAhead));
  const aheadHalf = add(agent.pos, scale(normalize(agent.vel), lookAhead * 0.5));

  let nearest: Obstacle | null = null;
  let nearestDist = Infinity;

  for (const obs of obstacles) {
    const combinedRadius = obs.radius + agent.radius;
    const d1 = dist(ahead, obs.pos);
    const d2 = dist(aheadHalf, obs.pos);
    const d3 = dist(agent.pos, obs.pos);
    const minD = Math.min(d1, d2, d3);

    if (minD < combinedRadius && minD < nearestDist) {
      nearest = obs;
      nearestDist = minD;
    }
  }

  if (!nearest) return vec2(0, 0);

  const avoidance = sub(ahead, nearest.pos);
  return limit(scale(normalize(avoidance), agent.maxForce * 2), agent.maxForce * 2);
}

/**
 * Follow path — steer along a series of waypoints.
 */
export function followPath(agent: Agent, path: Vec2[], pathRadius: number): Vec2 {
  if (path.length === 0) return vec2(0, 0);
  if (path.length === 1) return seek(agent, path[0]);

  // Predict future position
  const futurePos = add(agent.pos, scale(normalize(agent.vel), 25));

  // Find the closest point on each segment
  let bestTarget: Vec2 = path[0];
  let bestDist = Infinity;
  let bestSegIdx = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const ap = sub(futurePos, a);
    const ab = sub(b, a);
    const abMag = mag(ab);
    if (abMag < 0.001) continue;

    let t = dot(ap, ab) / (abMag * abMag);
    t = Math.max(0, Math.min(1, t));
    const closest = add(a, scale(ab, t));
    const d = dist(futurePos, closest);

    if (d < bestDist) {
      bestDist = d;
      bestTarget = closest;
      bestSegIdx = i;
    }
  }

  // If we're off the path, seek the closest point
  if (bestDist > pathRadius) {
    return seek(agent, bestTarget);
  }

  // Otherwise seek a point slightly ahead on the path
  const seg = path[bestSegIdx];
  const nextSeg = path[Math.min(bestSegIdx + 1, path.length - 1)];
  const dir = normalize(sub(nextSeg, seg));
  const target = add(bestTarget, scale(dir, 30));
  return seek(agent, target);
}

/**
 * Constrain — wrap agent position at boundaries (toroidal wrapping).
 */
export function constrain(agent: Agent, bounds: Bounds): Vec2 {
  const margin = 30;
  let steer = vec2(0, 0);

  if (agent.pos.x < bounds.x + margin) {
    steer = add(steer, vec2(agent.maxForce, 0));
  } else if (agent.pos.x > bounds.x + bounds.w - margin) {
    steer = add(steer, vec2(-agent.maxForce, 0));
  }

  if (agent.pos.y < bounds.y + margin) {
    steer = add(steer, vec2(0, agent.maxForce));
  } else if (agent.pos.y > bounds.y + bounds.h - margin) {
    steer = add(steer, vec2(0, -agent.maxForce));
  }

  return steer;
}

/**
 * Apply force — integrate a steering force into agent velocity and position.
 */
export function applyForce(agent: Agent, force: Vec2, dt: number): void {
  const acc = scale(force, 1 / agent.mass);
  agent.vel = add(agent.vel, scale(acc, dt));
  agent.vel = limit(agent.vel, agent.maxSpeed);
  agent.pos = add(agent.pos, scale(agent.vel, dt));
}

// ── Factory helpers ─────────────────────────────────────────────────

export function createAgent(
  x: number,
  y: number,
  maxSpeed: number = 3,
  maxForce: number = 0.15,
): Agent {
  const angle = Math.random() * Math.PI * 2;
  return {
    pos: vec2(x, y),
    vel: vec2(Math.cos(angle) * maxSpeed * 0.5, Math.sin(angle) * maxSpeed * 0.5),
    maxSpeed,
    maxForce,
    mass: 1,
    radius: 4,
  };
}

/**
 * Get neighbors within a given perception radius.
 */
export function getNeighbors(agent: Agent, all: Agent[], radius: number): Agent[] {
  const rSq = radius * radius;
  const result: Agent[] = [];
  for (const other of all) {
    if (other === agent) continue;
    if (distSq(agent.pos, other.pos) < rSq) {
      result.push(other);
    }
  }
  return result;
}
