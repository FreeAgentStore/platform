import type { Tool } from './agent-loop';

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'example_tool',
    description: 'An example tool. Replace with real tools.',
    parameters: {
      input: { type: 'string', description: 'The input to process' },
    },
    execute: async (params) => {
      return `Processed: ${params.input}`;
    },
  },
];
