import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ORG = 'FreeAgentStore';
const DOMAIN = 'freeagentstore.online';
const API_BASE = 'https://api.github.com';

export async function publish(opts: { name?: string; category?: string }) {
  // 1. Detect agent from current directory
  const agentJsonPath = path.resolve('agent.json');
  if (!fs.existsSync(agentJsonPath)) {
    console.error('No agent.json found. Run this from an agent directory.');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(agentJsonPath, 'utf-8'));
  const agentId = opts.name ?? detectAgentId();

  if (!agentId) {
    console.error('Could not detect agent ID. Pass --name <id> explicitly.');
    process.exit(1);
  }

  console.log(`Publishing ${agentId} to FreeAgentStore...\n`);

  // 2. Check gh CLI is available and authenticated
  try {
    execSync('gh auth status', { stdio: 'pipe' });
  } catch {
    console.error('Not authenticated with GitHub. Run: gh auth login');
    process.exit(1);
  }

  // 3. Check if repo already exists
  const repoExists = checkRepoExists(agentId);

  if (repoExists) {
    console.log(`Repo ${ORG}/${agentId} already exists. Pushing updates...`);
  } else {
    // 4. Create repo
    console.log(`Creating repo ${ORG}/${agentId}...`);
    try {
      execSync(
        `gh repo create ${ORG}/${agentId} --public --description "${manifest.description ?? agentId}" --clone=false`,
        { stdio: 'pipe' },
      );
      console.log(`  Created https://github.com/${ORG}/${agentId}`);
    } catch (e: any) {
      console.error(`Failed to create repo: ${e.message}`);
      process.exit(1);
    }
  }

  // 5. Set up git remote and push
  const cwd = process.cwd();
  const hasGit = fs.existsSync(path.join(cwd, '.git'));

  if (!hasGit) {
    execSync('git init', { cwd, stdio: 'pipe' });
    execSync('git add -A', { cwd, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd, stdio: 'pipe' });
  }

  // Set remote
  try {
    execSync(`git remote get-url origin`, { cwd, stdio: 'pipe' });
    execSync(`git remote set-url origin https://github.com/${ORG}/${agentId}.git`, { cwd, stdio: 'pipe' });
  } catch {
    execSync(`git remote add origin https://github.com/${ORG}/${agentId}.git`, { cwd, stdio: 'pipe' });
  }

  // Push
  console.log(`Pushing to ${ORG}/${agentId}...`);
  try {
    execSync('git push -u origin main', { cwd, stdio: 'inherit' });
  } catch {
    // Try with current branch name
    try {
      const branch = execSync('git branch --show-current', { cwd, encoding: 'utf-8' }).trim();
      execSync(`git push -u origin ${branch}:main`, { cwd, stdio: 'inherit' });
    } catch (e: any) {
      console.error(`Push failed: ${e.message}`);
      process.exit(1);
    }
  }

  // 6. Insert D1 route (via wrangler if available)
  console.log(`\nRegistering route...`);
  try {
    execSync(
      `npx wrangler d1 execute fags --remote --command "INSERT OR IGNORE INTO routes (slug, zone, r2_prefix, store, hosted_on, created_at, updated_at) VALUES ('${agentId}', '${DOMAIN}', 'agents/${agentId}', 'agents', 'r2', strftime('%s','now'), strftime('%s','now'))"`,
      { stdio: 'pipe', env: { ...process.env } },
    );
    console.log(`  Route registered: /a/${agentId}/`);
  } catch {
    console.log(`  Could not register route automatically.`);
    console.log(`  The deploy workflow will handle it, or run manually:`);
    console.log(`  npx wrangler d1 execute fags --remote --command "INSERT OR IGNORE INTO routes (slug, zone, r2_prefix, store, hosted_on, created_at, updated_at) VALUES ('${agentId}', '${DOMAIN}', 'agents/${agentId}', 'agents', 'r2', strftime('%s','now'), strftime('%s','now'))"`);
  }

  console.log(`\nPublished!`);
  console.log(`  Repo:  https://github.com/${ORG}/${agentId}`);
  console.log(`  Live:  https://${DOMAIN}/a/${agentId}/ (after first deploy)`);
  console.log(`  Store: https://${DOMAIN}/agents/${agentId}/`);
}

function detectAgentId(): string | null {
  // Try git remote
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    const match = remote.match(/\/([a-z0-9-]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {}

  // Try directory name
  const dirName = path.basename(process.cwd());
  if (/^[a-z0-9-]+$/.test(dirName)) return dirName;

  return null;
}

function checkRepoExists(agentId: string): boolean {
  try {
    execSync(`gh repo view ${ORG}/${agentId} --json name`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
