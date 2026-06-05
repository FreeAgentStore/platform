/**
 * Behavior Tree — pure TypeScript, zero DOM/React dependencies.
 * Composable behavior trees for game NPC AI.
 * Can be imported as an ESM library by FGS games.
 */

// ── Types ────────────────────────────────────────────────────────────

export type Status = 'running' | 'success' | 'failure';
export type Blackboard = Record<string, any>;

export interface BTNode {
  type: string;
  name: string;
  children?: BTNode[];
  lastStatus: Status | 'idle';
  tick(bb: Blackboard, dt: number): Status;
  reset(): void;
}

// ── Composite nodes ─────────────────────────────────────────────────

/**
 * Sequence — run children in order, fail on first failure.
 */
export class Sequence implements BTNode {
  type = 'sequence';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';
  private currentIndex = 0;

  constructor(public name: string, children: BTNode[] = []) {
    this.children = children;
  }

  tick(bb: Blackboard, dt: number): Status {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const status = child.tick(bb, dt);
      child.lastStatus = status;

      if (status === 'running') {
        this.lastStatus = 'running';
        return 'running';
      }
      if (status === 'failure') {
        this.lastStatus = 'failure';
        return 'failure';
      }
      this.currentIndex++;
    }
    this.lastStatus = 'success';
    return 'success';
  }

  reset(): void {
    this.currentIndex = 0;
    this.lastStatus = 'idle';
    for (const child of this.children) child.reset();
  }
}

/**
 * Selector — try children in order, succeed on first success.
 */
export class Selector implements BTNode {
  type = 'selector';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';
  private currentIndex = 0;

  constructor(public name: string, children: BTNode[] = []) {
    this.children = children;
  }

  tick(bb: Blackboard, dt: number): Status {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex];
      const status = child.tick(bb, dt);
      child.lastStatus = status;

      if (status === 'running') {
        this.lastStatus = 'running';
        return 'running';
      }
      if (status === 'success') {
        this.lastStatus = 'success';
        return 'success';
      }
      this.currentIndex++;
    }
    this.lastStatus = 'failure';
    return 'failure';
  }

  reset(): void {
    this.currentIndex = 0;
    this.lastStatus = 'idle';
    for (const child of this.children) child.reset();
  }
}

/**
 * Parallel — run all children. Configurable success/fail thresholds.
 */
export class Parallel implements BTNode {
  type = 'parallel';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';
  private successThreshold: number;
  private failThreshold: number;

  constructor(
    public name: string,
    children: BTNode[] = [],
    successThreshold?: number,
    failThreshold?: number,
  ) {
    this.children = children;
    this.successThreshold = successThreshold ?? children.length;
    this.failThreshold = failThreshold ?? 1;
  }

  tick(bb: Blackboard, dt: number): Status {
    let successes = 0;
    let failures = 0;

    for (const child of this.children) {
      const status = child.tick(bb, dt);
      child.lastStatus = status;
      if (status === 'success') successes++;
      if (status === 'failure') failures++;
    }

    if (successes >= this.successThreshold) {
      this.lastStatus = 'success';
      return 'success';
    }
    if (failures >= this.failThreshold) {
      this.lastStatus = 'failure';
      return 'failure';
    }
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.lastStatus = 'idle';
    for (const child of this.children) child.reset();
  }
}

// ── Decorator nodes ─────────────────────────────────────────────────

/**
 * Inverter — flip success/failure.
 */
export class Inverter implements BTNode {
  type = 'inverter';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private child: BTNode) {
    this.children = [child];
  }

  tick(bb: Blackboard, dt: number): Status {
    const status = this.child.tick(bb, dt);
    this.child.lastStatus = status;
    if (status === 'success') { this.lastStatus = 'failure'; return 'failure'; }
    if (status === 'failure') { this.lastStatus = 'success'; return 'success'; }
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.lastStatus = 'idle';
    this.child.reset();
  }
}

/**
 * Repeater — repeat child N times (0 = forever).
 */
export class Repeater implements BTNode {
  type = 'repeater';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';
  private count = 0;

  constructor(public name: string, private child: BTNode, private times: number = 0) {
    this.children = [child];
  }

  tick(bb: Blackboard, dt: number): Status {
    const status = this.child.tick(bb, dt);
    this.child.lastStatus = status;

    if (status === 'running') {
      this.lastStatus = 'running';
      return 'running';
    }

    this.count++;
    if (this.times > 0 && this.count >= this.times) {
      this.lastStatus = 'success';
      return 'success';
    }

    this.child.reset();
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.count = 0;
    this.lastStatus = 'idle';
    this.child.reset();
  }
}

/**
 * Succeeder — always return success.
 */
export class Succeeder implements BTNode {
  type = 'succeeder';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private child: BTNode) {
    this.children = [child];
  }

  tick(bb: Blackboard, dt: number): Status {
    const status = this.child.tick(bb, dt);
    this.child.lastStatus = status;
    if (status === 'running') { this.lastStatus = 'running'; return 'running'; }
    this.lastStatus = 'success';
    return 'success';
  }

  reset(): void {
    this.lastStatus = 'idle';
    this.child.reset();
  }
}

/**
 * UntilFail — repeat child until it returns failure.
 */
export class UntilFail implements BTNode {
  type = 'until-fail';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private child: BTNode) {
    this.children = [child];
  }

  tick(bb: Blackboard, dt: number): Status {
    const status = this.child.tick(bb, dt);
    this.child.lastStatus = status;
    if (status === 'failure') { this.lastStatus = 'success'; return 'success'; }
    if (status === 'success') { this.child.reset(); }
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.lastStatus = 'idle';
    this.child.reset();
  }
}

/**
 * Cooldown — prevent re-execution for N seconds after success/failure.
 */
export class Cooldown implements BTNode {
  type = 'cooldown';
  children: BTNode[];
  lastStatus: Status | 'idle' = 'idle';
  private cooldownLeft = 0;

  constructor(public name: string, private child: BTNode, private duration: number) {
    this.children = [child];
  }

  tick(bb: Blackboard, dt: number): Status {
    if (this.cooldownLeft > 0) {
      this.cooldownLeft -= dt;
      this.lastStatus = 'failure';
      return 'failure';
    }
    const status = this.child.tick(bb, dt);
    this.child.lastStatus = status;
    if (status !== 'running') {
      this.cooldownLeft = this.duration;
    }
    this.lastStatus = status;
    return status;
  }

  reset(): void {
    this.cooldownLeft = 0;
    this.lastStatus = 'idle';
    this.child.reset();
  }
}

// ── Leaf action nodes ───────────────────────────────────────────────

/**
 * Wait — running for N seconds, then success.
 */
export class Wait implements BTNode {
  type = 'wait';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';
  private elapsed = 0;

  constructor(public name: string, private seconds: number) {}

  tick(_bb: Blackboard, dt: number): Status {
    this.elapsed += dt;
    if (this.elapsed >= this.seconds) {
      this.lastStatus = 'success';
      return 'success';
    }
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.elapsed = 0;
    this.lastStatus = 'idle';
  }
}

/**
 * Log — write a message to the blackboard log array, then succeed.
 */
export class Log implements BTNode {
  type = 'log';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private message: string) {}

  tick(bb: Blackboard, _dt: number): Status {
    if (!bb._log) bb._log = [];
    bb._log.push(this.message);
    if (bb._log.length > 50) bb._log.shift();
    this.lastStatus = 'success';
    return 'success';
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * SetValue — set a blackboard key, then succeed.
 */
export class SetValue implements BTNode {
  type = 'set-value';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private key: string, private value: any) {}

  tick(bb: Blackboard, _dt: number): Status {
    bb[this.key] = typeof this.value === 'function' ? this.value(bb) : this.value;
    this.lastStatus = 'success';
    return 'success';
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * CheckValue — succeed if blackboard key matches expected value.
 */
export class CheckValue implements BTNode {
  type = 'check-value';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private key: string, private expected: any) {}

  tick(bb: Blackboard, _dt: number): Status {
    const match = typeof this.expected === 'function'
      ? this.expected(bb[this.key], bb)
      : bb[this.key] === this.expected;
    this.lastStatus = match ? 'success' : 'failure';
    return this.lastStatus;
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * RandomChance — succeed with given probability (0-1), else fail.
 */
export class RandomChance implements BTNode {
  type = 'random-chance';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private probability: number) {}

  tick(_bb: Blackboard, _dt: number): Status {
    this.lastStatus = Math.random() < this.probability ? 'success' : 'failure';
    return this.lastStatus;
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * MoveTo — move the NPC (bb.npcX, bb.npcY) toward a target (bb[targetKey]).
 * Returns running until within range, then success.
 */
export class MoveTo implements BTNode {
  type = 'move-to';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private targetKey: string, private speed: number = 80) {}

  tick(bb: Blackboard, dt: number): Status {
    const target = bb[this.targetKey];
    if (!target) { this.lastStatus = 'failure'; return 'failure'; }
    const tx = typeof target === 'object' ? target.x : 0;
    const ty = typeof target === 'object' ? target.y : 0;
    const dx = tx - (bb.npcX ?? 0);
    const dy = ty - (bb.npcY ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.lastStatus = 'success';
      return 'success';
    }

    const step = Math.min(this.speed * dt, dist);
    bb.npcX = (bb.npcX ?? 0) + (dx / dist) * step;
    bb.npcY = (bb.npcY ?? 0) + (dy / dist) * step;
    bb.npcState = 'walking';
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * IsInRange — succeed if NPC is within range of target.
 */
export class IsInRange implements BTNode {
  type = 'is-in-range';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';

  constructor(public name: string, private targetKey: string, private range: number) {}

  tick(bb: Blackboard, _dt: number): Status {
    const target = bb[this.targetKey];
    if (!target) { this.lastStatus = 'failure'; return 'failure'; }
    const dx = target.x - (bb.npcX ?? 0);
    const dy = target.y - (bb.npcY ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.lastStatus = dist <= this.range ? 'success' : 'failure';
    return this.lastStatus;
  }

  reset(): void {
    this.lastStatus = 'idle';
  }
}

/**
 * PlayAnimation — set bb.npcState = animation name, wait for duration.
 */
export class PlayAnimation implements BTNode {
  type = 'play-animation';
  children = undefined;
  lastStatus: Status | 'idle' = 'idle';
  private elapsed = 0;

  constructor(public name: string, private animation: string, private duration: number = 0.5) {}

  tick(bb: Blackboard, dt: number): Status {
    bb.npcState = this.animation;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.lastStatus = 'success';
      return 'success';
    }
    this.lastStatus = 'running';
    return 'running';
  }

  reset(): void {
    this.elapsed = 0;
    this.lastStatus = 'idle';
  }
}

// ── Builder API ─────────────────────────────────────────────────────

interface BuilderFrame {
  node: Sequence | Selector | Parallel;
}

export class BTBuilder {
  private stack: BuilderFrame[] = [];
  private root: BTNode | null = null;

  private pushComposite(node: Sequence | Selector | Parallel): BTBuilder {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].node.children.push(node);
    }
    this.stack.push({ node });
    if (!this.root) this.root = node;
    return this;
  }

  sequence(name: string): BTBuilder {
    return this.pushComposite(new Sequence(name));
  }

  selector(name: string): BTBuilder {
    return this.pushComposite(new Selector(name));
  }

  parallel(name: string, successThreshold?: number, failThreshold?: number): BTBuilder {
    return this.pushComposite(new Parallel(name, [], successThreshold, failThreshold));
  }

  leaf(name: string, node: BTNode): BTBuilder {
    node.name = name;
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].node.children.push(node);
    } else {
      this.root = node;
    }
    return this;
  }

  decorator(name: string, node: BTNode): BTBuilder {
    node.name = name;
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].node.children.push(node);
    } else {
      this.root = node;
    }
    return this;
  }

  end(): BTBuilder {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
    return this;
  }

  build(): BTNode {
    if (!this.root) throw new Error('Empty behavior tree');
    return this.root;
  }
}

export const BT = {
  sequence(name: string) { return new BTBuilder().sequence(name); },
  selector(name: string) { return new BTBuilder().selector(name); },
};

// ── Tree traversal helper ───────────────────────────────────────────

export interface FlatNode {
  node: BTNode;
  depth: number;
}

export function flattenTree(root: BTNode, depth: number = 0): FlatNode[] {
  const result: FlatNode[] = [{ node: root, depth }];
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenTree(child, depth + 1));
    }
  }
  return result;
}
