/**
 * Agent loop using native LLM tool calling.
 * No text parsing — uses structured tool_calls from the API.
 */

import type { LLMFn, LLMResponse, Message, ToolDef, ToolCall } from './inference';

export type { ToolCall };

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

export interface Step {
  id: number;
  thought: string | null;
  toolCalls: Array<{ name: string; input: Record<string, unknown>; result?: string; error?: string }>;
  status: 'thinking' | 'acting' | 'done' | 'error';
  error?: string;
  timestamp: number;
  duration?: number;
}

export interface AgentState {
  goal: string;
  steps: Step[];
  status: 'idle' | 'running' | 'paused' | 'done' | 'error';
  output?: string;
  startedAt?: number;
  completedAt?: number;
}

export type OnStepUpdate = (state: AgentState) => void;

export interface AgentHandle {
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

// Truncate tool results to avoid blowing context window
const MAX_TOOL_RESULT = 8000;
function truncateResult(s: string): string {
  if (s.length <= MAX_TOOL_RESULT) return s;
  return s.slice(0, MAX_TOOL_RESULT) + `\n\n[... truncated, ${s.length - MAX_TOOL_RESULT} chars omitted]`;
}

function toolsToToolDefs(tools: Tool[]): ToolDef[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function runAgent(
  goal: string,
  tools: Tool[],
  llm: LLMFn,
  onUpdate: OnStepUpdate,
  options: { maxSteps: number; systemPrompt: string },
): { promise: Promise<AgentState>; handle: AgentHandle } {
  let paused = false;
  let stopped = false;

  const handle: AgentHandle = {
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    stop: () => { stopped = true; paused = false; },
  };

  const toolDefs = toolsToToolDefs(tools);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const promise = (async () => {
    const state: AgentState = {
      goal,
      steps: [],
      status: 'running',
      startedAt: Date.now(),
    };
    onUpdate(state);

    const messages: Message[] = [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: goal },
    ];

    for (let i = 0; i < options.maxSteps; i++) {
      // Check stop before starting a new step
      if (stopped) {
        state.status = 'done';
        state.output = 'Stopped by user.';
        state.completedAt = Date.now();
        onUpdate({ ...state });
        return state;
      }

      // Handle pause
      while (paused) {
        state.status = 'paused';
        onUpdate({ ...state });
        await new Promise((r) => setTimeout(r, 500));
        if (stopped) {
          state.status = 'done';
          state.output = 'Stopped by user.';
          state.completedAt = Date.now();
          onUpdate({ ...state });
          return state;
        }
      }
      state.status = 'running';

      // Create step
      const step: Step = { id: i + 1, thought: null, toolCalls: [], status: 'thinking', timestamp: Date.now() };
      state.steps = [...state.steps, step];
      onUpdate({ ...state });

      // Call LLM with tools — retry once on transient errors
      let response: LLMResponse;
      try {
        response = await llm(messages, toolDefs);
      } catch (err: any) {
        // Retry once for rate limits and timeouts
        if (err.message === 'RATE_LIMITED' || err.name === 'TimeoutError') {
          step.thought = `Retrying after ${err.message === 'RATE_LIMITED' ? 'rate limit' : 'timeout'}...`;
          onUpdate({ ...state });
          await new Promise((r) => setTimeout(r, err.message === 'RATE_LIMITED' ? 5000 : 2000));
          try {
            response = await llm(messages, toolDefs);
          } catch (retryErr: any) {
            step.status = 'error';
            step.error = retryErr.message;
            step.duration = Date.now() - step.timestamp;
            state.status = 'error';
            state.output = `LLM error: ${retryErr.message}`;
            state.completedAt = Date.now();
            onUpdate({ ...state });
            return state;
          }
        } else {
          step.status = 'error';
          step.error = err.message;
          step.duration = Date.now() - step.timestamp;
          state.status = 'error';
          state.output = `LLM error: ${err.message}`;
          state.completedAt = Date.now();
          onUpdate({ ...state });
          return state;
        }
      }

      step.thought = response.text;

      // No tool calls = final answer
      if (response.toolCalls.length === 0) {
        step.status = 'done';
        step.duration = Date.now() - step.timestamp;
        state.output = response.text ?? 'No output.';
        state.status = 'done';
        state.completedAt = Date.now();
        messages.push({ role: 'assistant', content: response.text ?? '' });
        onUpdate({ ...state });
        return state;
      }

      // Execute tool calls
      step.status = 'acting';
      step.toolCalls = response.toolCalls.map((tc) => ({ name: tc.name, input: tc.input }));
      onUpdate({ ...state });

      messages.push({ role: 'assistant', content: response.text ?? '', toolCalls: response.toolCalls });

      for (const tc of step.toolCalls) {
        if (stopped) break;

        const tool = toolMap.get(tc.name);
        if (!tool) {
          tc.error = `Unknown tool: ${tc.name}. Available: ${[...toolMap.keys()].join(', ')}`;
          messages.push({ role: 'tool', toolName: tc.name, content: tc.error });
          continue;
        }
        try {
          const raw = await tool.execute(tc.input);
          tc.result = raw;
          messages.push({ role: 'tool', toolName: tc.name, content: truncateResult(raw) });
        } catch (err: any) {
          tc.error = err.message;
          messages.push({ role: 'tool', toolName: tc.name, content: `Error: ${err.message}` });
        }
      }

      step.duration = Date.now() - step.timestamp;
      onUpdate({ ...state });
    }

    state.status = 'done';
    state.output = 'Max steps reached. Check step log for partial results.';
    state.completedAt = Date.now();
    onUpdate({ ...state });
    return state;
  })();

  return { promise, handle };
}
