// @freeagentstore/sdk — main entry

export type { FreeAgentStore } from './agent.js';
export { initAgent } from './agent.js';
// Core primitives (vendored from FAS pattern)
export { Auth } from './auth.js';
export type { BuiltInAvailability, BuiltInSession } from './built-in-ai.js';
// Built-in AI (Chrome Gemini Nano / Edge Aion) — zero download
export {
  createPromptSession,
  createRewriter,
  createSummarizer,
  createTranslator,
  createWriter,
  detectBuiltInAI,
  smartPrompt,
} from './built-in-ai.js';
export type { EvalResult, HeuristicExample, HeuristicSpec, HeuristicVersion } from './heuristic.js';
// Heuristic agents — living code that evolves without runtime LLM
export { buildEvolvePrompt, evaluateHeuristic, extractCode } from './heuristic.js';
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
