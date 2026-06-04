// @freeagentstore/sdk — main entry

export { initAgent } from './agent.js';
export type { FreeAgentStore } from './agent.js';
export type { AgentConfig } from './types.js';

// Core primitives (vendored from FAS pattern)
export { Auth } from './auth.js';
export { Kv } from './kv.js';
export { Rooms } from './rooms.js';

// Agent-specific
export { ModelLoader } from './model.js';
export { WorkerBridge } from './worker-bridge.js';
export { OllamaClient } from './ollama.js';
export { ResultStore } from './result-store.js';
export { ModelCache } from './model-cache.js';

export type {
  ModelConfig,
  ModelStatus,
  InferenceResult,
  OllamaStatus,
  OllamaModel,
} from './types.js';
