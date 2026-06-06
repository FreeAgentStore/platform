/**
 * Mobile Mirror — pair mobile with desktop agent tab.
 * Desktop shows QR code / link -> mobile scans -> both see results in real-time.
 * Uses BroadcastChannel for same-device + HTTP polling via FAGS host worker for cross-device.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface MirrorConfig {
  agentId: string;
  /** Base URL for the mirror relay API. Defaults to https://freeagentstore.online */
  apiBase?: string;
  onMessage?: (msg: MirrorMessage) => void;
  onPeerConnected?: () => void;
  onPeerDisconnected?: () => void;
}

export interface MirrorMessage {
  type: 'result' | 'status' | 'input' | 'config';
  data: unknown;
  timestamp: number;
  from: 'desktop' | 'mobile';
}

export interface MirrorInstance {
  /** The room ID (8 chars). */
  readonly roomId: string;

  /** URL that mobile scans / visits. */
  getQRUrl(): string;
  getMobileUrl(): string;
  isConnected(): boolean;
  readonly peerCount: number;

  /** Send an arbitrary message. */
  send(msg: Omit<MirrorMessage, 'timestamp'>): void;
  /** Shorthand: send a result payload. */
  sendResult(data: unknown): void;
  /** Shorthand: send a status string. */
  sendStatus(status: string): void;

  /** Request browser notification permission. Returns true if granted. */
  requestPushPermission(): Promise<boolean>;
  /** Show a browser notification. Requires permission granted first. */
  sendPushNotification(title: string, body: string): Promise<void>;

  /** Stop polling, close BroadcastChannel, clean up. */
  destroy(): void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars

function generateRoomId(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

const DEFAULT_BASE = 'https://freeagentstore.online';
const POLL_INTERVAL = 2000;

// ── BroadcastChannel relay (same-device, instant) ────────────────────────────

function channelName(roomId: string): string {
  return `mirror:${roomId}`;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createMirror(config: MirrorConfig): MirrorInstance {
  const apiBase = (config.apiBase ?? DEFAULT_BASE).replace(/\/$/, '');
  const roomId = generateRoomId();
  const role: 'desktop' | 'mobile' = 'desktop'; // createMirror is always called from desktop

  let destroyed = false;
  let _peerCount = 0;
  let lastPollTs = Date.now();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // BroadcastChannel for same-device pairing
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(channelName(roomId));
    bc.onmessage = (ev) => {
      const msg = ev.data as MirrorMessage;
      if (msg.from !== role) {
        config.onMessage?.(msg);
      }
    };
  } catch {
    // BroadcastChannel not available (e.g. old browser) — cross-device only
  }

  // HTTP polling for cross-device
  async function poll(): Promise<void> {
    if (destroyed) return;
    try {
      const res = await fetch(`${apiBase}/v1/mirror/${roomId}?since=${lastPollTs}`);
      if (!res.ok) return;
      const body = await res.json() as { messages: MirrorMessage[]; peers: number };
      const prevPeers = _peerCount;
      _peerCount = body.peers ?? 0;

      if (prevPeers === 0 && _peerCount > 0) config.onPeerConnected?.();
      if (prevPeers > 0 && _peerCount === 0) config.onPeerDisconnected?.();

      for (const msg of body.messages ?? []) {
        if (msg.from !== role) {
          lastPollTs = Math.max(lastPollTs, msg.timestamp);
          config.onMessage?.(msg);
        }
      }
    } catch {
      // network error — silently retry next interval
    }
  }

  pollTimer = setInterval(poll, POLL_INTERVAL);
  // First poll immediately
  poll();

  const instance: MirrorInstance = {
    roomId,

    getQRUrl(): string {
      return `${apiBase}/mirror/?room=${roomId}&agent=${encodeURIComponent(config.agentId)}`;
    },

    getMobileUrl(): string {
      return `${apiBase}/mirror/?room=${roomId}&agent=${encodeURIComponent(config.agentId)}`;
    },

    isConnected(): boolean {
      return _peerCount > 0;
    },

    get peerCount() {
      return _peerCount;
    },

    send(msg: Omit<MirrorMessage, 'timestamp'>): void {
      if (destroyed) return;
      const full: MirrorMessage = { ...msg, timestamp: Date.now() } as MirrorMessage;

      // Broadcast locally
      try {
        bc?.postMessage(full);
      } catch { /* closed */ }

      // Send to relay API
      fetch(`${apiBase}/v1/mirror/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(full),
      }).catch(() => {});
    },

    sendResult(data: unknown): void {
      instance.send({ type: 'result', data, from: role });
    },

    sendStatus(status: string): void {
      instance.send({ type: 'status', data: status, from: role });
    },

    async requestPushPermission(): Promise<boolean> {
      if (typeof Notification === 'undefined') return false;
      const result = await Notification.requestPermission();
      return result === 'granted';
    },

    async sendPushNotification(title: string, body: string): Promise<void> {
      if (typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;
      new Notification(title, {
        body,
        icon: `${apiBase}/icon-192.png`,
        tag: `mirror-${roomId}`,
      });
    },

    destroy(): void {
      destroyed = true;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      try { bc?.close(); } catch { /* already closed */ }
      bc = null;
    },
  };

  return instance;
}

// ── Mobile-side mirror (used by the mirror page) ─────────────────────────────

export interface MobileMirrorConfig {
  roomId: string;
  agentId: string;
  apiBase?: string;
  onMessage?: (msg: MirrorMessage) => void;
  onConnected?: () => void;
}

export interface MobileMirrorInstance {
  send(msg: Omit<MirrorMessage, 'timestamp'>): void;
  sendInput(data: unknown): void;
  destroy(): void;
}

export function joinMirror(config: MobileMirrorConfig): MobileMirrorInstance {
  const apiBase = (config.apiBase ?? DEFAULT_BASE).replace(/\/$/, '');
  const { roomId } = config;
  const role: 'desktop' | 'mobile' = 'mobile';

  let destroyed = false;
  let lastPollTs = Date.now();
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  // BroadcastChannel for same-device
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(channelName(roomId));
    bc.onmessage = (ev) => {
      const msg = ev.data as MirrorMessage;
      if (msg.from !== role) config.onMessage?.(msg);
    };
  } catch { /* not available */ }

  // Announce presence via a 'ping' message
  fetch(`${apiBase}/v1/mirror/${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'status', data: 'mobile_joined', from: role, timestamp: Date.now() }),
  }).catch(() => {});

  async function poll(): Promise<void> {
    if (destroyed) return;
    try {
      const res = await fetch(`${apiBase}/v1/mirror/${roomId}?since=${lastPollTs}`);
      if (!res.ok) return;
      const body = await res.json() as { messages: MirrorMessage[] };
      for (const msg of body.messages ?? []) {
        if (msg.from !== role) {
          lastPollTs = Math.max(lastPollTs, msg.timestamp);
          config.onMessage?.(msg);
        }
      }
    } catch { /* retry */ }
  }

  pollTimer = setInterval(poll, POLL_INTERVAL);
  poll().then(() => config.onConnected?.());

  const inst: MobileMirrorInstance = {
    send(msg: Omit<MirrorMessage, 'timestamp'>): void {
      if (destroyed) return;
      const full: MirrorMessage = { ...msg, timestamp: Date.now() } as MirrorMessage;
      try { bc?.postMessage(full); } catch { /* closed */ }
      fetch(`${apiBase}/v1/mirror/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(full),
      }).catch(() => {});
    },

    sendInput(data: unknown): void {
      inst.send({ type: 'input', data, from: role });
    },

    destroy(): void {
      destroyed = true;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      try { bc?.close(); } catch { /* already closed */ }
      bc = null;
    },
  };

  return inst;
}
