import fs from 'node:fs';
import path from 'node:path';

const TEMPLATES: Record<string, string> = {
  'agent-tts': 'template-agent-tts',
  'agent-whisper': 'template-agent-whisper',
  'agent-vision': 'template-agent-vision',
  'agent-llm': 'template-agent-llm',
  'agent-tools': 'template-agent-tools',
};

export async function init(agentId: string, templateName: string) {
  const template = TEMPLATES[templateName];
  if (!template) {
    console.error(`Unknown template: ${templateName}`);
    console.error(`Available: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  const targetDir = path.resolve(agentId);
  if (fs.existsSync(targetDir)) {
    console.error(`Directory ${agentId} already exists.`);
    process.exit(1);
  }

  // TODO: Download template from GitHub or local templates dir
  console.log(`Scaffolding ${agentId} from ${template}...`);
  console.log(`Template: ${template}`);
  console.log(`Target: ${targetDir}`);
  console.log('');
  console.log('Template scaffolding will be implemented when templates are built (Phase 2).');
  console.log('For now, copy a template manually from ~/dev/stores/fags/templates/');
}
