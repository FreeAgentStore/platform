import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runAgent } from './agent-loop';
import type { Tool, Step, AgentState } from './agent-loop';
import type { LLMFn, LLMResponse, Message, ToolDef } from './inference';

// ── Helpers ──────────────────────────────────────────────────

function makeTool(name: string, result = 'ok'): Tool {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { input: { type: 'string', description: 'input', required: true } },
    execute: vi.fn().mockResolvedValue(result),
  };
}

/** Creates an LLM mock that returns the given responses in sequence. */
function makeLLM(responses: LLMResponse[]): LLMFn {
  let callIndex = 0;
  return vi.fn(async (_messages: Message[], _tools: ToolDef[]): Promise<LLMResponse> => {
    if (callIndex >= responses.length) {
      return { text: 'Fallback final answer', toolCalls: [], stopReason: 'end' };
    }
    return responses[callIndex++];
  });
}

const SYSTEM_PROMPT = 'You are a test agent.';
const GOAL = 'Do something useful.';

function noToolCallsResponse(text = 'Done.'): LLMResponse {
  return { text, toolCalls: [], stopReason: 'end' };
}

function toolCallResponse(
  toolName: string,
  input: Record<string, unknown> = {},
  text: string | null = 'Thinking...',
): LLMResponse {
  return {
    text,
    toolCalls: [{ name: toolName, input }],
    stopReason: 'tool_use',
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('runAgent', () => {
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
  });

  it('completes immediately when LLM returns no tool calls (final answer)', async () => {
    const llm = makeLLM([noToolCallsResponse('The answer is 42.')]);
    const tools = [makeTool('search')];

    const { promise } = runAgent(GOAL, tools, llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('The answer is 42.');
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0].status).toBe('done');
    expect(state.completedAt).toBeTypeOf('number');
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('executes tools when LLM returns tool_calls, then completes on final answer', async () => {
    const tool = makeTool('search', 'Found: relevant data');
    const llm = makeLLM([
      toolCallResponse('search', { input: 'query' }),
      noToolCallsResponse('Based on the search, the answer is X.'),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Based on the search, the answer is X.');
    expect(state.steps).toHaveLength(2);
    expect(state.steps[0].toolCalls).toHaveLength(1);
    expect(state.steps[0].toolCalls[0].name).toBe('search');
    expect(state.steps[0].toolCalls[0].result).toBe('Found: relevant data');
    expect(tool.execute).toHaveBeenCalledWith({ input: 'query' });
  });

  it('handles unknown tool names gracefully — error in step, loop continues', async () => {
    const tool = makeTool('search');
    const llm = makeLLM([
      toolCallResponse('nonexistent_tool', {}),
      noToolCallsResponse('Recovered.'),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Recovered.');
    expect(state.steps[0].toolCalls[0].error).toContain('Unknown tool: nonexistent_tool');
    expect(state.steps[0].toolCalls[0].error).toContain('search');
  });

  it('stops when stop() is called', async () => {
    // LLM always returns a tool call so the loop would never end on its own
    const tool = makeTool('search');
    const llm: LLMFn = vi.fn(async () => {
      // After first call, trigger stop
      handle.stop();
      return toolCallResponse('search', { input: 'x' });
    });

    const { promise, handle } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 100,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Stopped by user.');
    expect(state.completedAt).toBeTypeOf('number');
  });

  it('pauses and resumes', async () => {
    let callCount = 0;
    const llm: LLMFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return toolCallResponse('search', { input: 'first' });
      }
      return noToolCallsResponse('Done after pause.');
    });
    const tool = makeTool('search');

    const { promise, handle } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    // Pause briefly after first step starts, then resume
    await new Promise((r) => setTimeout(r, 50));
    handle.pause();

    // Verify paused status is emitted
    await new Promise((r) => setTimeout(r, 600));
    const pausedUpdates = onUpdate.mock.calls.filter(
      ([s]: [AgentState]) => s.status === 'paused',
    );
    expect(pausedUpdates.length).toBeGreaterThan(0);

    handle.resume();
    const state = await promise;
    expect(state.status).toBe('done');
  });

  it('retries on RATE_LIMITED error', async () => {
    const tool = makeTool('search');
    let callCount = 0;
    const llm: LLMFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('RATE_LIMITED');
      }
      return noToolCallsResponse('Recovered from rate limit.');
    });

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Recovered from rate limit.');
    expect(llm).toHaveBeenCalledTimes(2);
    // The step thought should mention retrying
    expect(state.steps[0].thought).toContain('rate limit');
  });

  it('retries on TimeoutError', async () => {
    const tool = makeTool('search');
    let callCount = 0;
    const llm: LLMFn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('Timed out');
        err.name = 'TimeoutError';
        throw err;
      }
      return noToolCallsResponse('Recovered from timeout.');
    });

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Recovered from timeout.');
    expect(llm).toHaveBeenCalledTimes(2);
    expect(state.steps[0].thought).toContain('timeout');
  });

  it('returns error state when retry also fails', async () => {
    const llm: LLMFn = vi.fn(async () => {
      throw new Error('RATE_LIMITED');
    });

    const { promise } = runAgent(GOAL, [], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('error');
    expect(state.output).toContain('LLM error');
    expect(state.output).toContain('RATE_LIMITED');
    expect(llm).toHaveBeenCalledTimes(2);
  });

  it('returns error state on non-retryable error', async () => {
    const llm: LLMFn = vi.fn(async () => {
      throw new Error('NOT_SIGNED_IN');
    });

    const { promise } = runAgent(GOAL, [], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('error');
    expect(state.output).toContain('NOT_SIGNED_IN');
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it('respects maxSteps limit', async () => {
    // LLM always returns tool calls, never a final answer
    const tool = makeTool('search');
    const llm = makeLLM([
      toolCallResponse('search', { input: '1' }),
      toolCallResponse('search', { input: '2' }),
      toolCallResponse('search', { input: '3' }),
      toolCallResponse('search', { input: '4' }),
      toolCallResponse('search', { input: '5' }),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 3,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.output).toBe('Max steps reached. Check step log for partial results.');
    expect(state.steps).toHaveLength(3);
  });

  it('truncates tool results exceeding MAX_TOOL_RESULT (8KB)', async () => {
    const longResult = 'x'.repeat(10_000);
    const tool = makeTool('search', longResult);
    const llm = makeLLM([
      toolCallResponse('search', { input: 'q' }),
      noToolCallsResponse('Done.'),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');

    // The raw result stored on the step should be the full result
    expect(state.steps[0].toolCalls[0].result).toBe(longResult);

    // Check that the message sent to LLM is truncated by inspecting the llm call args
    const secondCallMessages = (llm as ReturnType<typeof vi.fn>).mock.calls[1][0] as Message[];
    const toolMsg = secondCallMessages.find((m: Message) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect((toolMsg as any).content.length).toBeLessThan(longResult.length);
    expect((toolMsg as any).content).toContain('[... truncated');
  });

  it('executes multiple tool calls in one step', async () => {
    const searchTool = makeTool('search', 'search result');
    const calcTool = makeTool('calculate', '42');
    const llm = makeLLM([
      {
        text: 'Using both tools.',
        toolCalls: [
          { name: 'search', input: { input: 'query' } },
          { name: 'calculate', input: { input: '6*7' } },
        ],
        stopReason: 'tool_use',
      },
      noToolCallsResponse('Both tools returned results.'),
    ]);

    const { promise } = runAgent(GOAL, [searchTool, calcTool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.steps[0].toolCalls).toHaveLength(2);
    expect(state.steps[0].toolCalls[0].result).toBe('search result');
    expect(state.steps[0].toolCalls[1].result).toBe('42');
    expect(searchTool.execute).toHaveBeenCalledTimes(1);
    expect(calcTool.execute).toHaveBeenCalledTimes(1);
  });

  it('catches and reports tool execution errors', async () => {
    const tool: Tool = {
      name: 'failing_tool',
      description: 'Always fails',
      parameters: { input: { type: 'string', description: 'input' } },
      execute: vi.fn().mockRejectedValue(new Error('Disk full')),
    };
    const llm = makeLLM([
      toolCallResponse('failing_tool', { input: 'x' }),
      noToolCallsResponse('Tool failed, answering anyway.'),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.status).toBe('done');
    expect(state.steps[0].toolCalls[0].error).toBe('Disk full');
    expect(state.steps[0].toolCalls[0].result).toBeUndefined();

    // Error message should be sent to LLM as tool result
    const secondCallMessages = (llm as ReturnType<typeof vi.fn>).mock.calls[1][0] as Message[];
    const toolMsg = secondCallMessages.find((m: Message) => m.role === 'tool');
    expect((toolMsg as any).content).toContain('Error: Disk full');
  });

  it('calls onUpdate at each state change', async () => {
    const tool = makeTool('search', 'data');
    const llm = makeLLM([
      toolCallResponse('search', { input: 'q' }),
      noToolCallsResponse('Final.'),
    ]);

    const { promise } = runAgent(GOAL, [tool], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    await promise;

    // Should be called at least: initial running, step thinking, step acting,
    // step done (after tool), step 2 thinking, step 2 done
    expect(onUpdate.mock.calls.length).toBeGreaterThanOrEqual(5);

    // First call should be status 'running'
    expect(onUpdate.mock.calls[0][0].status).toBe('running');
  });

  it('sets startedAt on state', async () => {
    const llm = makeLLM([noToolCallsResponse('Done.')]);
    const { promise } = runAgent(GOAL, [], llm, onUpdate, {
      maxSteps: 1,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.startedAt).toBeTypeOf('number');
    expect(state.startedAt).toBeLessThanOrEqual(Date.now());
  });

  it('returns "No output." when LLM text is null with no tool calls', async () => {
    const llm = makeLLM([{ text: null, toolCalls: [], stopReason: 'end' }]);

    const { promise } = runAgent(GOAL, [], llm, onUpdate, {
      maxSteps: 10,
      systemPrompt: SYSTEM_PROMPT,
    });

    const state = await promise;
    expect(state.output).toBe('No output.');
  });
});
