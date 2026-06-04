// @freeagentstore/sdk — main entry

export type { FreeAgentStore } from './agent.js';
export { initAgent } from './agent.js';
// Core primitives (vendored from FAS pattern)
export { Auth } from './auth.js';
export { Kv } from './kv.js';
// Agent-specific
export { ModelLoader } from './model.js';
export { ModelCache } from './model-cache.js';
export { OllamaClient } from './ollama.js';
export { ResultStore } from './result-store.js';
export { Rooms } from './rooms.js';
export type {
  AgentConfig,
  InferenceResult,
  ModelConfig,
  ModelStatus,
  OllamaModel,
  OllamaStatus,
} from './types.js';
export { WorkerBridge } from './worker-bridge.js';
// Heuristic agents — living code that evolves without runtime LLM
export { evaluateHeuristic, buildEvolvePrompt, extractCode } from './heuristic.js';
export type { HeuristicSpec, HeuristicExample, HeuristicVersion, EvalResult } from './heuristic.js';
