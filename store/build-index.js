#!/usr/bin/env node
/**
 * Generates agent cards in store/index.html from registry.json.
 * Replaces the contents of <div class="agents-grid" id="agentsGrid">...</div>
 * and updates the agent count + category filter buttons.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry.json'), 'utf-8'));
const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

const agents = registry.agents;

// --- Type label + style mapping ---
function getTypeTag(agent) {
  if (agent.evolution) {
    // Evolved agent — show accuracy% or example count as second tag
    const secondTag = agent.evolution.accuracy
      ? `${agent.evolution.accuracy}%`
      : `${agent.evolution.examples} examples`;
    return {
      label: 'Evolved',
      style: 'background:rgba(217,119,6,0.15);color:#fbbf24',
      secondTag,
    };
  }

  switch (agent.type) {
    case 'heuristic':
      return {
        label: 'Heuristic',
        style: 'background:rgba(217,119,6,0.15);color:#fbbf24',
        secondTag: agent.modelSize || '0MB',
      };
    case 'model':
      return {
        label: 'Model',
        style: 'background:rgba(59,130,246,0.15);color:#60a5fa',
        secondTag: agent.modelSize || '0MB',
      };
    case 'built-in-ai':
      return {
        label: 'Built-in AI',
        style: 'background:rgba(5,150,105,0.2);color:#34d399',
        secondTag: agent.modelSize || '0MB',
      };
    default:
      // developer-tools and any other types
      return {
        label: agent.type.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
        style: 'background:rgba(124,58,237,0.15);color:#a78bfa',
        secondTag: agent.modelSize || '0MB',
      };
  }
}

// Special icon rendering: some icons use HTML entities or monospace font
function renderIcon(agent) {
  const icon = agent.icon;
  // Check if it looks like a short text icon (monospace-style) rather than an emoji
  const isTextIcon = /^[^a-zA-Z]*[a-zA-Z{}#.*<>/]+[^a-zA-Z]*$/.test(icon) && icon.length <= 5;
  const fontStyle = isTextIcon
    ? `;font-family:monospace;font-size:${icon.length > 2 ? '0.75rem' : icon.length > 1 ? '0.9rem' : '1.2rem'}`
    : '';
  return { content: icon, fontStyle };
}

function truncate(str, len) {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Generate card HTML for one agent ---
function generateCard(agent) {
  const { label, style, secondTag } = getTypeTag(agent);
  const { content: iconContent, fontStyle } = renderIcon(agent);
  const desc = escapeHtml(truncate(agent.description, 60));

  // For game-ai category with heuristic type (no evolution), show "Game AI" label
  const displayLabel = (agent.category === 'game-ai' && agent.type === 'heuristic' && !agent.evolution)
    ? 'Game AI'
    : label;
  const displayStyle = (agent.category === 'game-ai' && agent.type === 'heuristic' && !agent.evolution)
    ? 'background:rgba(217,119,6,0.15);color:#fbbf24'
    : style;

  return `        <div class="agent-card" data-category="${agent.category}">
          <a href="/agents/${agent.id}/" class="agent-card-body">
            <div class="agent-icon" style="background:${agent.iconBg}${fontStyle}">${iconContent}</div>
            <div class="agent-body">
              <span class="agent-name">${escapeHtml(agent.name)}</span>
              <span class="agent-desc">${desc}</span>
              <div class="agent-meta">
                <span class="tag" style="${displayStyle}">${displayLabel}</span>
                <span class="tag">${escapeHtml(secondTag)}</span>
              </div>
            </div>
          </a>
          <a href="/a/${agent.id}/" class="agent-cta">
            <svg viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20"/></svg>
            Open
          </a>
        </div>`;
}

// --- Build all cards ---
const cardsHtml = agents.map(generateCard).join('\n\n');

// --- Replace agents-grid content ---
const gridOpenTag = '<div class="agents-grid" id="agentsGrid">';
const gridStart = html.indexOf(gridOpenTag);
if (gridStart === -1) {
  console.error('ERROR: Could not find agents-grid div in index.html');
  process.exit(1);
}
const contentStart = gridStart + gridOpenTag.length;

// Find the matching closing </div> — count nesting
let depth = 1;
let pos = contentStart;
while (depth > 0 && pos < html.length) {
  const nextOpen = html.indexOf('<div', pos);
  const nextClose = html.indexOf('</div>', pos);
  if (nextClose === -1) break;
  if (nextOpen !== -1 && nextOpen < nextClose) {
    depth++;
    pos = nextOpen + 4;
  } else {
    depth--;
    if (depth === 0) {
      // nextClose is our closing tag
      html = html.slice(0, contentStart) + '\n' + cardsHtml + '\n      ' + html.slice(nextClose);
    } else {
      pos = nextClose + 6;
    }
  }
}

// --- Update agent count ---
html = html.replace(
  /<span class="agent-count"[^>]*>[^<]*<\/span>/,
  `<span class="agent-count" id="agentCount">${agents.length} agents</span>`
);

// --- Update category filter buttons ---
// Collect all unique categories from registry
const categories = [...new Set(agents.map(a => a.category))];
// Sort but keep a nice order: put common ones first
const categoryOrder = ['text', 'productivity', 'code', 'game-ai', 'creative', 'audio', 'vision', 'automation', 'web-analysis', 'developer-tools', 'education'];
categories.sort((a, b) => {
  const ai = categoryOrder.indexOf(a);
  const bi = categoryOrder.indexOf(b);
  return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
});

function categoryLabel(cat) {
  const special = { 'game-ai': 'Game AI', 'ai': 'AI' };
  if (special[cat]) return special[cat];
  return cat.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

const filterButtons = [
  `<button class="filter-btn active" onclick="filterAgents('all')">All</button>`,
  ...categories.map(c => `<button class="filter-btn" onclick="filterAgents('${c}')">${categoryLabel(c)}</button>`),
];

// Replace the first toolbar's filter buttons (between <div class="toolbar"> and <span class="agent-count")
const toolbarMatch = html.match(/<div class="toolbar">\s*\n([\s\S]*?)<span class="agent-count"/);
if (toolbarMatch) {
  const oldButtons = toolbarMatch[1];
  const newButtons = '        ' + filterButtons.join('\n        ') + '\n        ';
  html = html.replace(oldButtons, newButtons);
}

// --- Write back ---
fs.writeFileSync(indexPath, html, 'utf-8');
console.log(`Updated index.html with ${agents.length} agent cards and ${categories.length} category filters.`);
