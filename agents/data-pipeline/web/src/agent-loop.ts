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
    stop: () => { stopped = true; },
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
      if (stopped) {
        state.status = 'done';
        state.output = 'Stopped by user.';
        state.completedAt = Date.now();
        onUpdate({ ...state });
        break;
      }

      while (paused && !stopped) {
        state.status = 'paused';
        onUpdate({ ...state });
        await new Promise((r) => setTimeout(r, 500));
      }
      if (stopped) continue;
      state.status = 'running';

      // Create step
      const step: Step = { id: i + 1, thought: null, toolCalls: [], status: 'thinking', timestamp: Date.now() };
      state.steps = [...state.steps, step];
      onUpdate({ ...state });

      // Call LLM with tools
      let response: LLMResponse;
      try {
        response = await llm(messages, toolDefs);
      } catch (err: any) {
        step.status = 'error';
        step.error = err.message;
        step.duration = Date.now() - step.timestamp;
        state.status = 'error';
        state.output = `LLM error: ${err.message}`;
        state.completedAt = Date.now();
        onUpdate({ ...state });
        break;
      }

      step.thought = response.text;

      // No tool calls = final answer
      if (response.toolCalls.length === 0) {
        step.status = 'done';
        step.duration = Date.now() - step.timestamp;
        state.output = response.text ?? 'No output.';
        state.status = 'done';
        state.completedAt = Date.now();

        // Add assistant message to history
        messages.push({ role: 'assistant', content: response.text ?? '' });

        onUpdate({ ...state });
        break;
      }

      // Execute tool calls
      step.status = 'acting';
      step.toolCalls = response.toolCalls.map((tc) => ({ name: tc.name, input: tc.input }));
      onUpdate({ ...state });

      // Add assistant message with tool calls to history
      messages.push({ role: 'assistant', content: response.text ?? '', toolCalls: response.toolCalls });

      for (const tc of step.toolCalls) {
        const tool = toolMap.get(tc.name);
        if (!tool) {
          tc.error = `Unknown tool: ${tc.name}`;
          messages.push({ role: 'tool', toolName: tc.name, content: `Error: unknown tool "${tc.name}"` });
          continue;
        }
        try {
          tc.result = await tool.execute(tc.input);
          messages.push({ role: 'tool', toolName: tc.name, content: tc.result });
        } catch (err: any) {
          tc.error = err.message;
          messages.push({ role: 'tool', toolName: tc.name, content: `Error: ${err.message}` });
        }
      }

      step.duration = Date.now() - step.timestamp;
      onUpdate({ ...state });
    }

    if (state.status === 'running') {
      state.status = 'done';
      state.output = 'Max steps reached.';
      state.completedAt = Date.now();
      onUpdate({ ...state });
    }

    return state;
  })();

  return { promise, handle };
}
