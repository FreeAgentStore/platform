/**
 * Preset behavior trees for the demo.
 * Each returns a BTNode and initial blackboard state.
 */

import {
  type BTNode, type Blackboard,
  Sequence, Selector,
  Inverter, Repeater, Cooldown,
  Wait, Log, SetValue, CheckValue, RandomChance,
  MoveTo, IsInRange, PlayAnimation,
} from './bt';

export interface Preset {
  name: string;
  description: string;
  tree: BTNode;
  initBB: () => Blackboard;
  waypoints: { x: number; y: number }[];
  items: { x: number; y: number; id: string }[];
  storage: { x: number; y: number } | null;
  friends: { x: number; y: number; id: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function pickWaypoint(bb: Blackboard): { x: number; y: number } | null {
  const wps = bb._waypoints as { x: number; y: number }[] | undefined;
  if (!wps || wps.length === 0) return null;
  const idx = ((bb._wpIndex ?? 0) + 1) % wps.length;
  bb._wpIndex = idx;
  return wps[idx];
}

/** Leaf that picks the next patrol waypoint. */
class PickWaypoint {
  type = 'pick-waypoint';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickWaypoint') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    const wp = pickWaypoint(bb);
    if (wp) {
      bb.patrolTarget = { ...wp };
      this.lastStatus = 'success';
      return 'success' as const;
    }
    this.lastStatus = 'failure';
    return 'failure' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf that picks the nearest item. */
class PickNearestItem {
  type = 'pick-nearest-item';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickNearestItem') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    const items = bb._items as { x: number; y: number; id: string; taken: boolean }[] | undefined;
    if (!items) { this.lastStatus = 'failure'; return 'failure' as const; }
    let nearest: typeof items[0] | null = null;
    let nearestDist = Infinity;
    for (const item of items) {
      if (item.taken) continue;
      const dx = item.x - (bb.npcX ?? 0);
      const dy = item.y - (bb.npcY ?? 0);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) { nearestDist = d; nearest = item; }
    }
    if (nearest) {
      bb.itemTarget = { x: nearest.x, y: nearest.y };
      bb._currentItemId = nearest.id;
      this.lastStatus = 'success';
      return 'success' as const;
    }
    this.lastStatus = 'failure';
    return 'failure' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf that "picks up" the current item. */
class PickUpItem {
  type = 'pick-up';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickUp') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    const items = bb._items as { id: string; taken: boolean }[] | undefined;
    const id = bb._currentItemId;
    if (items && id) {
      const item = items.find(i => i.id === id);
      if (item) { item.taken = true; bb.carrying = (bb.carrying ?? 0) + 1; }
    }
    bb.npcState = 'pickup';
    this.lastStatus = 'success';
    return 'success' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf that deposits carried items. */
class DepositItem {
  type = 'deposit';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'deposit') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    bb.deposited = (bb.deposited ?? 0) + (bb.carrying ?? 0);
    bb.carrying = 0;
    bb.npcState = 'deposit';
    this.lastStatus = 'success';
    return 'success' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf that picks the nearest friend. */
class PickNearestFriend {
  type = 'pick-nearest-friend';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickNearestFriend') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    const friends = bb._friends as { x: number; y: number; id: string }[] | undefined;
    if (!friends || friends.length === 0) { this.lastStatus = 'failure'; return 'failure' as const; }
    let nearest = friends[0];
    let nearestDist = Infinity;
    for (const f of friends) {
      const dx = f.x - (bb.npcX ?? 0);
      const dy = f.y - (bb.npcY ?? 0);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) { nearestDist = d; nearest = f; }
    }
    bb.friendTarget = { x: nearest.x, y: nearest.y };
    this.lastStatus = 'success';
    return 'success' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf to pick a random flee destination. */
class PickFleeTarget {
  type = 'pick-flee-target';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickFleeTarget') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    const player = bb.player as { x: number; y: number } | undefined;
    if (!player) { this.lastStatus = 'failure'; return 'failure' as const; }
    // Flee in opposite direction from player
    const dx = (bb.npcX ?? 200) - player.x;
    const dy = (bb.npcY ?? 200) - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    bb.fleeTarget = {
      x: Math.max(30, Math.min(570, (bb.npcX ?? 200) + (dx / dist) * 150)),
      y: Math.max(30, Math.min(370, (bb.npcY ?? 200) + (dy / dist) * 150)),
    };
    this.lastStatus = 'success';
    return 'success' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

/** Leaf for random wander. */
class PickWanderTarget {
  type = 'pick-wander-target';
  name: string;
  children = undefined;
  lastStatus: 'success' | 'failure' | 'running' | 'idle' = 'idle';

  constructor(name: string = 'pickWanderTarget') { this.name = name; }

  tick(bb: Blackboard, _dt: number) {
    bb.wanderTarget = {
      x: 50 + Math.random() * 500,
      y: 50 + Math.random() * 300,
    };
    this.lastStatus = 'success';
    return 'success' as const;
  }

  reset() { this.lastStatus = 'idle'; }
}

// ── Preset 1: Guard ─────────────────────────────────────────────────

function createGuard(): Preset {
  const tree = new Selector('root', [
    // Priority 1: Attack if player in melee range
    new Sequence('attack', [
      new IsInRange('inRange?', 'player', 40),
      new Log('logAttack', 'Attacking!'),
      new PlayAnimation('attack', 'attack', 0.6),
    ]),
    // Priority 2: Chase if player detected
    new Sequence('chase', [
      new IsInRange('canSee?', 'player', 150),
      new Log('logChase', 'Player spotted! Chasing...'),
      new MoveTo('chase', 'player', 100),
    ]),
    // Priority 3: Patrol
    new Sequence('patrol', [
      new PickWaypoint('pickWP'),
      new Log('logPatrol', 'Patrolling...'),
      new MoveTo('goToWP', 'patrolTarget', 60),
      new Wait('lookAround', 1.0),
    ]),
  ]);

  const waypoints = [
    { x: 80, y: 100 }, { x: 480, y: 100 },
    { x: 480, y: 300 }, { x: 80, y: 300 },
  ];

  return {
    name: 'Guard',
    description: 'Patrol waypoints, detect player, chase, attack, return to patrol.',
    tree: new Repeater('loop', tree, 0),
    initBB: () => ({
      npcX: 80, npcY: 100, npcState: 'idle',
      player: { x: 300, y: 200 },
      _waypoints: waypoints, _wpIndex: -1,
    }),
    waypoints,
    items: [],
    storage: null,
    friends: [],
  };
}

// ── Preset 2: Coward ────────────────────────────────────────────────

function createCoward(): Preset {
  const tree = new Selector('root', [
    // Priority 1: Flee if player is close
    new Sequence('flee', [
      new IsInRange('dangerClose?', 'player', 120),
      new Log('logFlee', 'Danger! Fleeing!'),
      new PickFleeTarget('pickFleeTarget'),
      new MoveTo('runAway', 'fleeTarget', 120),
      new PlayAnimation('hide', 'hiding', 1.5),
      new Wait('cower', 1.0),
    ]),
    // Priority 2: Nervous if player visible
    new Sequence('nervous', [
      new IsInRange('canSee?', 'player', 200),
      new Log('logNervous', 'I see something... nervous.'),
      new PlayAnimation('nervous', 'nervous', 0.8),
    ]),
    // Priority 3: Wander
    new Sequence('wander', [
      new PickWanderTarget('pickWander'),
      new Log('logWander', 'Wandering around...'),
      new MoveTo('wander', 'wanderTarget', 40),
      new Wait('pause', 0.8),
    ]),
  ]);

  return {
    name: 'Coward',
    description: 'Wander peacefully. Detect danger, flee and hide, wait, resume wandering.',
    tree: new Repeater('loop', tree, 0),
    initBB: () => ({
      npcX: 300, npcY: 200, npcState: 'idle',
      player: { x: 100, y: 100 },
    }),
    waypoints: [],
    items: [],
    storage: null,
    friends: [],
  };
}

// ── Preset 3: Collector ─────────────────────────────────────────────

function createCollector(): Preset {
  const items = [
    { x: 100, y: 80, id: 'gem1' },
    { x: 450, y: 120, id: 'gem2' },
    { x: 250, y: 320, id: 'gem3' },
    { x: 500, y: 300, id: 'gem4' },
    { x: 150, y: 250, id: 'gem5' },
  ];
  const storage = { x: 300, y: 190 };

  const tree = new Selector('root', [
    // If carrying items, go deposit
    new Sequence('deposit', [
      new CheckValue('hasItems?', 'carrying', (v: any) => (v ?? 0) > 0),
      new Log('logDeposit', 'Carrying item, heading to storage...'),
      new SetValue('setStorage', 'storageTarget', storage),
      new MoveTo('goStorage', 'storageTarget', 70),
      new DepositItem('deposit'),
      new Log('logDeposited', 'Deposited!'),
      new Wait('rest', 0.4),
    ]),
    // Find and collect an item
    new Sequence('collect', [
      new PickNearestItem('findItem'),
      new Log('logCollect', 'Found item, going to collect...'),
      new MoveTo('goToItem', 'itemTarget', 70),
      new PickUpItem('pickUp'),
      new Log('logPickedUp', 'Picked up!'),
      new Wait('admire', 0.3),
    ]),
    // Nothing left, idle
    new Sequence('idle', [
      new Log('logIdle', 'Nothing to collect. Idling.'),
      new PlayAnimation('idle', 'idle', 2.0),
    ]),
  ]);

  return {
    name: 'Collector',
    description: 'Find nearest item, move to it, pick up, go to storage, deposit. Repeat.',
    tree: new Repeater('loop', tree, 0),
    initBB: () => ({
      npcX: 300, npcY: 190, npcState: 'idle',
      player: { x: -100, y: -100 }, // off-screen, not used
      _items: items.map(i => ({ ...i, taken: false })),
      carrying: 0, deposited: 0,
    }),
    waypoints: [],
    items,
    storage,
    friends: [],
  };
}

// ── Preset 4: Social ────────────────────────────────────────────────

function createSocial(): Preset {
  const friends = [
    { x: 120, y: 150, id: 'Alice' },
    { x: 450, y: 100, id: 'Bob' },
    { x: 350, y: 320, id: 'Carol' },
  ];

  const tree = new Selector('root', [
    // Socialize with a friend
    new Sequence('socialize', [
      new RandomChance('feelSocial?', 0.6),
      new PickNearestFriend('findFriend'),
      new Log('logApproach', 'Found a friend! Approaching...'),
      new MoveTo('approach', 'friendTarget', 60),
      new PlayAnimation('wave', 'wave', 0.5),
      new Log('logChat', 'Chatting...'),
      new Wait('chat', 1.5),
      new PlayAnimation('wave', 'wave', 0.4),
      new Log('logBye', 'Bye!'),
    ]),
    // Otherwise wander
    new Sequence('wander', [
      new PickWanderTarget('pickWander'),
      new Log('logWander', 'Just wandering...'),
      new MoveTo('wander', 'wanderTarget', 40),
      new Wait('pause', 0.6),
    ]),
  ]);

  return {
    name: 'Social',
    description: 'Wander around. Find a friend, approach, chat, wave, wander.',
    tree: new Repeater('loop', tree, 0),
    initBB: () => ({
      npcX: 250, npcY: 200, npcState: 'idle',
      player: { x: -100, y: -100 },
      _friends: friends,
    }),
    waypoints: [],
    items: [],
    storage: null,
    friends,
  };
}

// ── Preset 5: Boss ──────────────────────────────────────────────────

function createBoss(): Preset {
  const tree = new Selector('root', [
    // Phase: Heal if HP low and heal not on cooldown
    new Sequence('heal', [
      new CheckValue('lowHP?', 'hp', (v: any) => (v ?? 100) < 30),
      new Cooldown('healCD', new Sequence('doHeal', [
        new Log('logHeal', 'Healing...'),
        new PlayAnimation('heal', 'healing', 1.2),
        new SetValue('restoreHP', 'hp', (bb: any) => Math.min(100, (bb.hp ?? 0) + 40)),
        new Log('logHealed', 'Healed!'),
      ]), 8),
    ]),
    // Phase: AOE when player is close and HP < 50%
    new Sequence('aoe', [
      new CheckValue('halfHP?', 'hp', (v: any) => (v ?? 100) < 50),
      new IsInRange('playerClose?', 'player', 100),
      new Cooldown('aoeCD', new Sequence('doAOE', [
        new Log('logAOE', 'AOE ATTACK!'),
        new PlayAnimation('aoe', 'aoe', 0.8),
        new SetValue('aoeHit', 'lastAttack', 'aoe'),
      ]), 4),
    ]),
    // Phase: Charge when player is mid-range
    new Sequence('charge', [
      new IsInRange('playerMid?', 'player', 200),
      new Inverter('notTooClose', new IsInRange('tooClose?', 'player', 60)),
      new Log('logCharge', 'CHARGING!'),
      new MoveTo('charge', 'player', 150),
      new PlayAnimation('slam', 'slam', 0.5),
      new SetValue('slamHit', 'lastAttack', 'slam'),
    ]),
    // Phase: Ranged attack
    new Sequence('ranged', [
      new IsInRange('canSee?', 'player', 300),
      new Cooldown('rangedCD', new Sequence('doRanged', [
        new Log('logRanged', 'Ranged attack!'),
        new PlayAnimation('cast', 'cast', 0.6),
        new SetValue('castHit', 'lastAttack', 'cast'),
      ]), 2),
    ]),
    // Idle: move toward player slowly
    new Sequence('approach', [
      new Log('logApproach', 'Approaching...'),
      new MoveTo('approach', 'player', 30),
    ]),
  ]);

  return {
    name: 'Boss',
    description: 'Phase-based: ranged attacks, charge, AOE when close, heal when low HP.',
    tree: new Repeater('loop', tree, 0),
    initBB: () => ({
      npcX: 480, npcY: 200, npcState: 'idle',
      player: { x: 120, y: 200 },
      hp: 100, lastAttack: null,
    }),
    waypoints: [],
    items: [],
    storage: null,
    friends: [],
  };
}

// ── Export ───────────────────────────────────────────────────────────

export const PRESETS: Preset[] = [
  createGuard(),
  createCoward(),
  createCollector(),
  createSocial(),
  createBoss(),
];
