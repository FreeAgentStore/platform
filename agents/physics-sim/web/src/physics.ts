/**
 * Verlet Integration Physics — pure TypeScript, zero DOM/React dependencies.
 * Particles, springs, cloth, soft bodies, ragdolls.
 * Can be imported as an ESM library by FGS games.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Particle {
  pos: Vec2;
  prev: Vec2;
  acc: Vec2;
  mass: number;
  radius: number;
  pinned: boolean;
}

export interface Constraint {
  type: 'distance';
  a: number;   // particle index
  b: number;
  restLength: number;
  stiffness: number;  // 0-1
  tearable: boolean;
  broken: boolean;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhysicsWorld {
  particles: Particle[];
  constraints: Constraint[];
}

// ── Particle creation ───────────────────────────────────────────────

export function createParticle(
  x: number,
  y: number,
  mass: number = 1,
  pinned: boolean = false,
  radius: number = 3,
): Particle {
  return {
    pos: { x, y },
    prev: { x, y },
    acc: { x: 0, y: 0 },
    mass,
    radius,
    pinned,
  };
}

// ── Constraint creation ─────────────────────────────────────────────

export function createConstraint(
  a: number,
  b: number,
  particles: Particle[],
  stiffness: number = 1.0,
  tearable: boolean = false,
): Constraint {
  const pa = particles[a];
  const pb = particles[b];
  const dx = pb.pos.x - pa.pos.x;
  const dy = pb.pos.y - pa.pos.y;
  return {
    type: 'distance',
    a,
    b,
    restLength: Math.sqrt(dx * dx + dy * dy),
    stiffness,
    tearable,
    broken: false,
  };
}

// ── World creation ──────────────────────────────────────────────────

export function createWorld(): PhysicsWorld {
  return { particles: [], constraints: [] };
}

export function addParticle(world: PhysicsWorld, p: Particle): number {
  world.particles.push(p);
  return world.particles.length - 1;
}

export function addConstraint(world: PhysicsWorld, c: Constraint): void {
  world.constraints.push(c);
}

// ── Physics step ────────────────────────────────────────────────────

export function step(
  world: PhysicsWorld,
  dt: number,
  gravity: Vec2,
  iterations: number,
  bounds: Bounds,
  damping: number = 0.99,
): void {
  const { particles, constraints } = world;

  // 1. Apply gravity + accumulate forces
  for (const p of particles) {
    if (p.pinned) continue;
    p.acc.x += gravity.x;
    p.acc.y += gravity.y;
  }

  // 2. Verlet integration
  for (const p of particles) {
    if (p.pinned) {
      p.acc.x = 0;
      p.acc.y = 0;
      continue;
    }
    const vx = (p.pos.x - p.prev.x) * damping;
    const vy = (p.pos.y - p.prev.y) * damping;
    p.prev.x = p.pos.x;
    p.prev.y = p.pos.y;
    p.pos.x += vx + p.acc.x * dt * dt;
    p.pos.y += vy + p.acc.y * dt * dt;
    p.acc.x = 0;
    p.acc.y = 0;
  }

  // 3. Satisfy constraints (iterate for stability)
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of constraints) {
      if (c.broken) continue;
      const pa = particles[c.a];
      const pb = particles[c.b];
      const dx = pb.pos.x - pa.pos.x;
      const dy = pb.pos.y - pa.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const diff = (c.restLength - dist) / dist;

      // Check for tearing
      if (c.tearable && Math.abs(dist - c.restLength) > c.restLength * 2.5) {
        c.broken = true;
        continue;
      }

      const stiffFactor = c.stiffness * 0.5;
      const offsetX = dx * diff * stiffFactor;
      const offsetY = dy * diff * stiffFactor;

      if (!pa.pinned && !pb.pinned) {
        const totalMass = pa.mass + pb.mass;
        const ratioA = pb.mass / totalMass;
        const ratioB = pa.mass / totalMass;
        pa.pos.x -= offsetX * ratioA;
        pa.pos.y -= offsetY * ratioA;
        pb.pos.x += offsetX * ratioB;
        pb.pos.y += offsetY * ratioB;
      } else if (!pa.pinned) {
        pa.pos.x -= offsetX;
        pa.pos.y -= offsetY;
      } else if (!pb.pinned) {
        pb.pos.x += offsetX;
        pb.pos.y += offsetY;
      }
    }

    // 4. Bound collision
    for (const p of particles) {
      if (p.pinned) continue;
      const r = p.radius;
      if (p.pos.y > bounds.y + bounds.h - r) {
        p.pos.y = bounds.y + bounds.h - r;
        p.prev.y = p.pos.y + (p.pos.y - p.prev.y) * 0.3; // bounce
      }
      if (p.pos.y < bounds.y + r) {
        p.pos.y = bounds.y + r;
        p.prev.y = p.pos.y;
      }
      if (p.pos.x < bounds.x + r) {
        p.pos.x = bounds.x + r;
        p.prev.x = p.pos.x;
      }
      if (p.pos.x > bounds.x + bounds.w - r) {
        p.pos.x = bounds.x + bounds.w - r;
        p.prev.x = p.pos.x;
      }
    }
  }
}

// ── Force helpers ───────────────────────────────────────────────────

export function applyForce(particle: Particle, force: Vec2): void {
  particle.acc.x += force.x / particle.mass;
  particle.acc.y += force.y / particle.mass;
}

export function applyExplosion(
  particles: Particle[],
  center: Vec2,
  force: number,
  radius: number,
): void {
  for (const p of particles) {
    if (p.pinned) continue;
    const dx = p.pos.x - center.x;
    const dy = p.pos.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist > radius) continue;
    const strength = (1 - dist / radius) * force;
    const nx = dx / dist;
    const ny = dy / dist;
    // Apply as velocity change (modify prev to change velocity)
    p.prev.x -= nx * strength;
    p.prev.y -= ny * strength;
  }
}

// ── Preset structures ───────────────────────────────────────────────

/**
 * Create a cloth: grid of particles with distance constraints.
 */
export function createCloth(
  world: PhysicsWorld,
  x: number,
  y: number,
  cols: number,
  rows: number,
  spacing: number,
  pinTop: boolean = true,
  tearable: boolean = true,
): void {
  const startIdx = world.particles.length;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = x + c * spacing;
      const py = y + r * spacing;
      const pinned = pinTop && r === 0 && c % 3 === 0;
      addParticle(world, createParticle(px, py, 1, pinned, 2));
    }
  }

  // Horizontal constraints
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = startIdx + r * cols + c;
      const b = startIdx + r * cols + c + 1;
      addConstraint(world, createConstraint(a, b, world.particles, 0.9, tearable));
    }
  }

  // Vertical constraints
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = startIdx + r * cols + c;
      const b = startIdx + (r + 1) * cols + c;
      addConstraint(world, createConstraint(a, b, world.particles, 0.9, tearable));
    }
  }
}

/**
 * Create a rope: chain of particles.
 */
export function createRope(
  world: PhysicsWorld,
  x: number,
  y: number,
  length: number,
  segments: number,
  pinStart: boolean = true,
): void {
  const segLen = length / segments;
  const startIdx = world.particles.length;

  for (let i = 0; i <= segments; i++) {
    const pinned = pinStart && i === 0;
    addParticle(world, createParticle(x, y + i * segLen, 1, pinned, 3));
  }

  for (let i = 0; i < segments; i++) {
    addConstraint(world, createConstraint(
      startIdx + i,
      startIdx + i + 1,
      world.particles,
      1.0,
      false,
    ));
  }
}

/**
 * Create a soft body: ring of particles with cross-constraints.
 */
export function createSoftBody(
  world: PhysicsWorld,
  x: number,
  y: number,
  radius: number,
  segments: number,
): void {
  const startIdx = world.particles.length;
  // Center particle
  addParticle(world, createParticle(x, y, 2, false, 2));
  const centerIdx = startIdx;

  // Ring particles
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    addParticle(world, createParticle(px, py, 1, false, 3));
  }

  // Ring constraints (adjacent)
  for (let i = 0; i < segments; i++) {
    const a = startIdx + 1 + i;
    const b = startIdx + 1 + ((i + 1) % segments);
    addConstraint(world, createConstraint(a, b, world.particles, 0.8, false));
  }

  // Spoke constraints (center to ring)
  for (let i = 0; i < segments; i++) {
    addConstraint(world, createConstraint(
      centerIdx,
      startIdx + 1 + i,
      world.particles,
      0.5,
      false,
    ));
  }

  // Cross-brace constraints (every other)
  for (let i = 0; i < segments; i++) {
    const opposite = (i + Math.floor(segments / 2)) % segments;
    addConstraint(world, createConstraint(
      startIdx + 1 + i,
      startIdx + 1 + opposite,
      world.particles,
      0.3,
      false,
    ));
  }
}

/**
 * Create a ragdoll: head, torso, arms, legs.
 */
export function createRagdoll(
  world: PhysicsWorld,
  x: number,
  y: number,
): void {
  const s = world.particles.length;

  // 0: head
  addParticle(world, createParticle(x, y, 1.5, false, 6));
  // 1: neck
  addParticle(world, createParticle(x, y + 15, 1, false, 3));
  // 2: shoulder-L
  addParticle(world, createParticle(x - 20, y + 20, 1, false, 3));
  // 3: shoulder-R
  addParticle(world, createParticle(x + 20, y + 20, 1, false, 3));
  // 4: elbow-L
  addParticle(world, createParticle(x - 35, y + 40, 0.8, false, 2));
  // 5: elbow-R
  addParticle(world, createParticle(x + 35, y + 40, 0.8, false, 2));
  // 6: hand-L
  addParticle(world, createParticle(x - 45, y + 60, 0.6, false, 2));
  // 7: hand-R
  addParticle(world, createParticle(x + 45, y + 60, 0.6, false, 2));
  // 8: torso (hip center)
  addParticle(world, createParticle(x, y + 50, 2, false, 3));
  // 9: hip-L
  addParticle(world, createParticle(x - 12, y + 55, 1, false, 3));
  // 10: hip-R
  addParticle(world, createParticle(x + 12, y + 55, 1, false, 3));
  // 11: knee-L
  addParticle(world, createParticle(x - 12, y + 80, 1, false, 2));
  // 12: knee-R
  addParticle(world, createParticle(x + 12, y + 80, 1, false, 2));
  // 13: foot-L
  addParticle(world, createParticle(x - 12, y + 105, 0.8, false, 2));
  // 14: foot-R
  addParticle(world, createParticle(x + 12, y + 105, 0.8, false, 2));

  const link = (a: number, b: number, stiff: number = 1.0) => {
    addConstraint(world, createConstraint(s + a, s + b, world.particles, stiff, false));
  };

  // Spine
  link(0, 1, 1.0);  // head-neck
  link(1, 8, 0.9);  // neck-torso

  // Shoulders
  link(1, 2, 0.9);  // neck-shoulderL
  link(1, 3, 0.9);  // neck-shoulderR
  link(2, 3, 0.7);  // shoulder brace

  // Arms
  link(2, 4, 0.8);  // shoulderL-elbowL
  link(3, 5, 0.8);  // shoulderR-elbowR
  link(4, 6, 0.7);  // elbowL-handL
  link(5, 7, 0.7);  // elbowR-handR

  // Hips
  link(8, 9, 0.9);  // torso-hipL
  link(8, 10, 0.9); // torso-hipR
  link(9, 10, 0.7); // hip brace

  // Legs
  link(9, 11, 0.9);  // hipL-kneeL
  link(10, 12, 0.9); // hipR-kneeR
  link(11, 13, 0.8); // kneeL-footL
  link(12, 14, 0.8); // kneeR-footR

  // Structural braces (prevent collapse)
  link(0, 8, 0.4);  // head-torso
  link(2, 8, 0.3);  // shoulderL-torso
  link(3, 8, 0.3);  // shoulderR-torso
  link(9, 13, 0.2); // hipL-footL (leg stiffness)
  link(10, 14, 0.2); // hipR-footR
}

// ── Utility ─────────────────────────────────────────────────────────

/**
 * Find nearest particle to a point within maxDist.
 */
export function findNearest(
  world: PhysicsWorld,
  x: number,
  y: number,
  maxDist: number = Infinity,
): number {
  let best = -1;
  let bestDist = maxDist * maxDist;
  for (let i = 0; i < world.particles.length; i++) {
    const p = world.particles[i];
    const dx = p.pos.x - x;
    const dy = p.pos.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      best = i;
    }
  }
  return best;
}

/**
 * Tear constraints near a point.
 */
export function tearAt(
  world: PhysicsWorld,
  x: number,
  y: number,
  radius: number,
): void {
  for (const c of world.constraints) {
    if (c.broken) continue;
    const pa = world.particles[c.a];
    const pb = world.particles[c.b];
    const mx = (pa.pos.x + pb.pos.x) / 2;
    const my = (pa.pos.y + pb.pos.y) / 2;
    const dx = mx - x;
    const dy = my - y;
    if (dx * dx + dy * dy < radius * radius) {
      c.broken = true;
    }
  }
}
