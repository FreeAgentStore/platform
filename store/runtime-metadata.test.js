import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyRuntimeMetadata, validateRuntimeMetadata } from './runtime-metadata.js';

const agent = { id: 'transcriber', name: 'Transcriber', description: 'Transcribe audio using Whisper.' };
const html = '<html><head><title>tts — FreeAgentStore</title><meta name="description" content="Convert text to speech"><meta name="robots" content="noindex"><link rel="canonical" href="https://freeagentstore.online/"></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';

test('repairs copied identity while preserving app scripts and indexing exclusions', () => {
  assert.throws(() => validateRuntimeMetadata(html, agent), /does not match/);
  const result = applyRuntimeMetadata(html, agent);
  assert.ok(!result.includes('tts —'));
  assert.ok(!result.includes('Convert text to speech'));
  assert.ok(result.includes('href="https://freeagentstore.online/a/transcriber/"'));
  assert.ok(result.includes('<meta name="robots" content="noindex">'));
  assert.ok(result.includes('<script type="module" src="/src/main.tsx"></script>'));
  assert.doesNotThrow(() => validateRuntimeMetadata(result, agent));
  assert.equal(applyRuntimeMetadata(result, agent), result);
});

test('escapes registry attributes and text without introducing markup', () => {
  const result = applyRuntimeMetadata(html, { ...agent, name: 'Quotes " & <tags>', description: 'It\'s <private> & safe.' });
  assert.ok(result.includes('Quotes &quot; &amp; &lt;tags&gt;'));
  assert.ok(result.includes('It&#39;s &lt;private&gt; &amp; safe.'));
  assert.ok(!result.includes('<private>'));
});

test('rejects missing or template registry metadata and invalid HTML', () => {
  assert.throws(() => applyRuntimeMetadata(html, { ...agent, name: 'AGENTNAME' }), /Template/);
  assert.throws(() => applyRuntimeMetadata(html, { ...agent, description: '' }), /requires/);
  assert.throws(() => applyRuntimeMetadata('<body>missing head</body>', agent), /exactly one head/);
});
