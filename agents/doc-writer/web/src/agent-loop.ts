/**
 * ReAct agent loop — plan, act, observe, decide.
 * Runs autonomously with step-by-step callbacks for UI updates.
 */

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

export interface Step {
  id: number;
  thought: string;
  action?: { tool: string; input: Record<string, unknown> };
  observation?: string;
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

type LLMFn = (messages: Array<{ role: string; content: string }>) => Promise<string>;

function buildToolsPrompt(tools: Tool[]): string {
  return tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `    "${k}": ${v.type}${v.required !== false ? ' (required)' : ''} — ${v.description}`)
        .join('\n');
      return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
    })
    .join('\n\n');
}

interface ParsedResponse {
  thought: string;
  action?: { tool: string; input: Record<string, unknown> };
  done: boolean;
  output?: string;
}

function parseResponse(text: string): ParsedResponse {
  // Strip markdown code fences that LLMs sometimes wrap responses in
  const cleaned = text.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();

  // Extract thought — everything before ACTION/DONE/INPUT keywords
  const thought = cleaned.match(/THOUGHT:\s*([\s\S]*?)(?=\n\s*(?:ACTION|DONE|INPUT)\s*:)/i)?.[1]?.trim()
    ?? cleaned.match(/THOUGHT:\s*([\s\S]*)/i)?.[1]?.trim()
    ?? cleaned.split('\n')[0].trim();

  // Check for DONE
  const doneMatch = cleaned.match(/DONE:\s*([\s\S]*)/i);
  if (doneMatch) {
    return { thought, done: true, output: doneMatch[1].trim() };
  }

  // Check for ACTION + INPUT — handle various LLM formatting quirks
  // Match ACTION: tool_name (with optional backticks, quotes, markdown)
  const actionMatch = cleaned.match(/ACTION:\s*[`"']*(\w[\w-]*)[`"']*/i);

  // Match INPUT: {...} — greedy match for the JSON object, handle multiline
  const inputMatch = cleaned.match(/INPUT:\s*[`]*(\{[\s\S]*\})[`]*/i);

  if (actionMatch) {
    let input: Record<string, unknown> = {};
    if (inputMatch) {
      // Try parsing the JSON — clean up common LLM mistakes first
      let jsonStr = inputMatch[1]
        .replace(/,\s*}/g, '}')          // trailing commas
        .replace(/'/g, '"')              // single quotes to double
        .replace(/(\w+)\s*:/g, '"$1":'); // unquoted keys — risky but common

      try {
        input = JSON.parse(inputMatch[1]); // try original first
      } catch {
        try {
          input = JSON.parse(jsonStr); // try cleaned version
        } catch {
          input = { raw: inputMatch[1] };
        }
      }
    }
    return {
      thought,
      action: { tool: actionMatch[1].trim(), input },
      done: false,
    };
  }

  // No structured format found — this step has no action
  return { thought, done: false };
}

/** Abort handle returned by runAgent */
export interface AgentHandle {
  pause: () => void;
  resume: () => void;
  stop: () => void;
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

  const promise = (async () => {
    const toolsPrompt = buildToolsPrompt(tools);

    const systemMessage = `${options.systemPrompt}

You are an autonomous agent that works step by step to accomplish goals.

Available tools:
${toolsPrompt}

Response format — use EXACTLY one of:

Option A (use a tool):
THOUGHT: [your reasoning about what to do next]
ACTION: [tool_name]
INPUT: {"param": "value"}

Option B (task complete):
THOUGHT: [summary of what you accomplished]
DONE: [final output/result in full]

Rules:
- Always start with THOUGHT
- Use one tool per step
- If a tool fails, try a different approach
- When the task is fully complete, use DONE with the complete result`;

    const state: AgentState = {
      goal,
      steps: [],
      status: 'running',
      startedAt: Date.now(),
    };
    onUpdate(state);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemMessage },
      { role: 'user', content: `Goal: ${goal}` },
    ];

    for (let i = 0; i < options.maxSteps; i++) {
      if (stopped) {
        state.status = 'done';
        state.output = 'Stopped by user. Partial results in step log.';
        state.completedAt = Date.now();
        onUpdate(state);
        break;
      }

      // Wait while paused
      while (paused && !stopped) {
        state.status = 'paused';
        onUpdate(state);
        await new Promise((r) => setTimeout(r, 500));
      }
      if (stopped) continue;
      state.status = 'running';

      const step: Step = {
        id: i + 1,
        thought: '',
        status: 'thinking',
        timestamp: Date.now(),
      };
      state.steps = [...state.steps, step];
      onUpdate({ ...state });

      // Get LLM response
      let response: string;
      try {
        response = await llm(messages);
      } catch (err: any) {
        step.status = 'error';
        step.error = `LLM error: ${err.message}`;
        step.duration = Date.now() - step.timestamp;
        state.status = 'error';
        state.output = `Failed at step ${step.id}: ${err.message}`;
        state.completedAt = Date.now();
        onUpdate({ ...state });
        break;
      }

      const parsed = parseResponse(response);
      step.thought = parsed.thought;
      messages.push({ role: 'assistant', content: response });

      if (parsed.done) {
        step.status = 'done';
        step.duration = Date.now() - step.timestamp;
        state.output = parsed.output;
        state.status = 'done';
        state.completedAt = Date.now();
        onUpdate({ ...state });
        break;
      }

      if (parsed.action) {
        step.action = parsed.action;
        step.status = 'acting';
        onUpdate({ ...state });

        const tool = tools.find((t) => t.name === parsed.action!.tool);
        if (!tool) {
          step.observation = `Error: Unknown tool "${parsed.action.tool}". Available: ${tools.map((t) => t.name).join(', ')}`;
          step.status = 'error';
        } else {
          try {
            step.observation = await tool.execute(parsed.action.input);
          } catch (err: any) {
            step.observation = `Tool error: ${err.message}`;
          }
        }

        step.duration = Date.now() - step.timestamp;
        onUpdate({ ...state });

        messages.push({
          role: 'user',
          content: `OBSERVATION: ${(step.observation ?? '').slice(0, 4000)}`,
        });
      } else {
        // LLM didn't produce an action or done — nudge it
        step.duration = Date.now() - step.timestamp;
        onUpdate({ ...state });
        messages.push({
          role: 'user',
          content: 'Please respond with either ACTION + INPUT to use a tool, or DONE with the final result.',
        });
      }
    }

    if (state.status === 'running') {
      state.status = 'done';
      state.output = 'Max steps reached. Check step log for partial results.';
      state.completedAt = Date.now();
      onUpdate({ ...state });
    }

    return state;
  })();

  return { promise, handle };
}
