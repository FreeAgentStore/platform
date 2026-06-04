#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
  .name('fags')
  .description('CLI for AI tools on freeagentstore.online')
  .version('0.1.0');

program
  .command('init <agent-id>')
  .description('Scaffold a new agent from a template')
  .option('-t, --template <name>', 'template to use', 'agent-tts')
  .action(async (agentId: string, opts: { template: string }) => {
    const { init } = await import('./commands/init.js');
    await init(agentId, opts.template);
  });

program
  .command('check')
  .description('Run compliance checks on current agent')
  .action(async () => {
    const { check } = await import('./commands/check.js');
    await check();
  });

program
  .command('publish')
  .description('Publish agent to the store')
  .option('--name <name>', 'agent display name')
  .option('--category <category>', 'agent category')
  .action(async (opts: { name?: string; category?: string }) => {
    const { publish } = await import('./commands/publish.js');
    await publish(opts);
  });

program.parse();
