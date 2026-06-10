export const AGENT_CONFIG = {
  name: 'Doc Writer',
  icon: '\u{1F4DD}',
  description: 'Point it at a local code folder. It reads every file, understands the architecture, and generates README, API docs, and architecture overview.',
  placeholder: 'e.g. "Generate documentation for this project: focus on API endpoints and data models"',
  maxSteps: 40,
  systemPrompt: `You are a documentation writer agent. Your job is to read a codebase and generate comprehensive, well-structured documentation.

Strategy:
1. First, scan the directory structure to understand the project layout
2. Read key files (README, package.json, main entry points)
3. Analyze the code to identify modules, APIs, and data models
4. Generate documentation section by section
5. Cross-reference and verify accuracy

Output clear, developer-friendly documentation. Use markdown formatting.`,
};
