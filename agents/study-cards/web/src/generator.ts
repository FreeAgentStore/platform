/**
 * Flashcard generator — heuristic-based, no model needed for text input.
 * Extracts definitions, facts, lists, cause/effect, and keyword-based cards.
 */

export interface Flashcard {
  front: string;
  back: string;
  type: 'definition' | 'fact' | 'concept' | 'list';
}

export interface StudySet {
  title: string;
  cards: Flashcard[];
  source: 'text' | 'audio';
  wordCount: number;
}

// ── Stopwords ──

const STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
  't', 'can', 'will', 'just', 'don', 'should', 'now', 'also', 'well', 'get',
  'got', 'going', 'go', 'come', 'one', 'would', 'could', 'make', 'made',
]);

// ── Sentence splitting ──

function splitSentences(text: string): string[] {
  // Handle multiple paragraphs, bullets, etc.
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.replace(/^[\s\-*•\d.]+/, '').trim())
    .filter(s => s.length > 10);
}

// ── Title extraction ──

function extractTitle(text: string): string {
  // Use the first significant line, or first few keywords
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  const first = lines[0]?.trim() ?? '';
  if (first.length > 5 && first.length < 80 && !first.includes('.')) {
    return first;
  }
  // Extract from prominent keywords
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  if (top.length > 0) {
    return top.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Study Set';
  }
  return 'Study Set';
}

// ── Strategy 1: Definition extraction ──
// Pattern: "X is Y", "X are Y", "X refers to Y", "X means Y", "X is defined as Y"

function extractDefinitions(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];
  const patterns = [
    /^(.+?)\s+(?:is|are)\s+(?:defined as|described as)\s+(.+)/i,
    /^(.+?)\s+refers?\s+to\s+(.+)/i,
    /^(.+?)\s+means?\s+(.+)/i,
    /^(.+?)\s+(?:is|are)\s+(?:a|an|the)\s+(.+)/i,
    /^(.+?)\s+(?:is|are)\s+(.{20,})/i, // "X is Y" where Y is substantial
  ];

  for (const sentence of sentences) {
    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        const subject = match[1].trim();
        const definition = match[2].trim().replace(/\.$/, '');

        // Skip if subject is too long (probably not a definition)
        if (subject.split(/\s+/).length > 6) continue;
        // Skip if definition is too short
        if (definition.split(/\s+/).length < 3) continue;

        cards.push({
          front: `What is ${subject.toLowerCase().replace(/^the\s+/i, '')}?`,
          back: definition.charAt(0).toUpperCase() + definition.slice(1),
          type: 'definition',
        });
        break; // Only match first pattern per sentence
      }
    }
  }
  return cards;
}

// ── Strategy 2: Key fact extraction ──
// Sentences with numbers, dates, superlatives

function extractFacts(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const sentence of sentences) {
    // Superlative facts: "The largest X is Y"
    const superlativeMatch = sentence.match(
      /(?:the\s+)?(largest|smallest|biggest|tallest|shortest|oldest|youngest|fastest|slowest|longest|highest|lowest|most\s+\w+|least\s+\w+|first|last)\s+(.+?)\s+(?:is|are|was|were)\s+(.+)/i
    );
    if (superlativeMatch) {
      const adj = superlativeMatch[1];
      const subject = superlativeMatch[2].trim();
      const answer = superlativeMatch[3].trim().replace(/\.$/, '');
      cards.push({
        front: `What is the ${adj.toLowerCase()} ${subject.toLowerCase()}?`,
        back: answer.charAt(0).toUpperCase() + answer.slice(1),
        type: 'fact',
      });
      continue;
    }

    // Numeric facts: sentences with significant numbers
    const numMatch = sentence.match(
      /(.+?)\s+(?:is|are|was|were|has|have|contains?|consists?\s+of|measures?|weighs?)\s+(.+?\d[\d,.]*\s*\w+.*)/i
    );
    if (numMatch) {
      const subject = numMatch[1].trim();
      const factPart = numMatch[2].trim().replace(/\.$/, '');
      if (subject.split(/\s+/).length <= 8) {
        // Try to form a question
        const verb = sentence.match(/\b(is|are|was|were|has|have|contains?|measures?|weighs?)\b/i)?.[1]?.toLowerCase() ?? 'is';
        let question: string;
        if (/\bhow\s+(many|much|old|long|big|tall|far|fast|heavy|large)\b/i.test(factPart)) {
          question = sentence; // Already a question
        } else if (/\d/.test(factPart)) {
          // Ask "How many/much" type questions
          question = `How much/many ${verb} ${subject.toLowerCase().replace(/^the\s+/i, '')}?`;
        } else {
          question = `What ${verb} ${subject.toLowerCase().replace(/^the\s+/i, '')}?`;
        }
        cards.push({
          front: question,
          back: factPart.charAt(0).toUpperCase() + factPart.slice(1),
          type: 'fact',
        });
      }
    }
  }
  return cards;
}

// ── Strategy 3: List extraction ──
// Detect "such as X, Y, and Z", "including X, Y, Z", "consists of", bullet points

function extractLists(sentences: string[], fullText: string): Flashcard[] {
  const cards: Flashcard[] = [];

  // Inline lists: "such as X, Y, and Z"
  const inlinePatterns = [
    /(.+?)\s+(?:such as|including|like|for example|e\.g\.)\s+(.+)/i,
    /(.+?)\s+(?:consists?\s+of|is\s+composed\s+of|is\s+made\s+up\s+of|comprises?)\s+(.+)/i,
    /(?:there\s+are|the)\s+(\w+)\s+(?:main\s+)?(?:types?\s+of|kinds?\s+of|categories\s+of|stages?\s+of|steps?\s+in|phases?\s+of|parts?\s+of)\s+(.+?):\s*(.+)/i,
  ];

  for (const sentence of sentences) {
    for (const pattern of inlinePatterns) {
      const match = sentence.match(pattern);
      if (match) {
        // For the "there are N types of X: ..." pattern
        if (match[3]) {
          const count = match[1];
          const subject = match[2].trim();
          const items = match[3].trim().replace(/\.$/, '');
          cards.push({
            front: `What are the ${count} ${subject.toLowerCase()}?`,
            back: items,
            type: 'list',
          });
        } else {
          const context = match[1].trim();
          const items = match[2].trim().replace(/\.$/, '');
          const listItems = items.split(/,\s*(?:and\s+)?|;\s*/).filter(i => i.trim().length > 0);
          if (listItems.length >= 2) {
            cards.push({
              front: `What are examples of ${context.toLowerCase().replace(/^the\s+/i, '').replace(/\s+(?:include|are)\s*$/i, '')}?`,
              back: listItems.map(i => i.trim()).join(', '),
              type: 'list',
            });
          }
        }
        break;
      }
    }
  }

  // Detect numbered/bulleted list blocks
  const listBlockMatch = fullText.match(
    /(.+?):\s*\n((?:\s*[-*\d.]+\s+.+\n?)+)/g
  );
  if (listBlockMatch) {
    for (const block of listBlockMatch) {
      const headerMatch = block.match(/^(.+?):\s*\n/);
      const itemsMatch = block.match(/[-*\d.]+\s+(.+)/g);
      if (headerMatch && itemsMatch && itemsMatch.length >= 2) {
        const header = headerMatch[1].trim();
        const items = itemsMatch.map(m => m.replace(/^[-*\d.]+\s+/, '').trim());
        cards.push({
          front: `What are the ${items.length} ${header.toLowerCase().replace(/^the\s+/i, '')}?`,
          back: items.join(', '),
          type: 'list',
        });
      }
    }
  }

  // "Two main stages" pattern
  for (const sentence of sentences) {
    const stageMatch = sentence.match(
      /(?:there\s+are\s+)?(\w+)\s+(?:main\s+)?(?:stages?|steps?|phases?|types?|kinds?|parts?|components?)\b.*?:\s*(.+)/i
    );
    if (stageMatch && !cards.some(c => c.front.includes(stageMatch[1]))) {
      const items = stageMatch[2].trim().replace(/\.$/, '');
      const listItems = items.split(/,\s*(?:and\s+)?|\s+and\s+/).filter(i => i.trim().length > 0);
      if (listItems.length >= 2) {
        cards.push({
          front: `What are the ${stageMatch[1].toLowerCase()} stages/types?`,
          back: listItems.map(i => i.trim()).join(', '),
          type: 'list',
        });
      }
    }
  }

  return cards;
}

// ── Strategy 4: Cause/effect ──

function extractCauseEffect(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const sentence of sentences) {
    // "X because Y"
    const becauseMatch = sentence.match(/(.+?)\s+because\s+(.+)/i);
    if (becauseMatch) {
      const effect = becauseMatch[1].trim().replace(/\.$/, '');
      const cause = becauseMatch[2].trim().replace(/\.$/, '');
      if (effect.split(/\s+/).length >= 3 && cause.split(/\s+/).length >= 3) {
        cards.push({
          front: `Why ${effect.replace(/^this\s+/i, '').replace(/^it\s+/i, '').toLowerCase()}?`,
          back: `Because ${cause}`,
          type: 'concept',
        });
      }
      continue;
    }

    // "X, therefore Y" / "X, as a result, Y"
    const thereforeMatch = sentence.match(
      /(.+?),?\s+(?:therefore|thus|hence|consequently|as a result|which (?:means|leads to|causes|results in))\s+(.+)/i
    );
    if (thereforeMatch) {
      const cause = thereforeMatch[1].trim().replace(/\.$/, '');
      const effect = thereforeMatch[2].trim().replace(/\.$/, '');
      if (cause.split(/\s+/).length >= 3 && effect.split(/\s+/).length >= 3) {
        cards.push({
          front: `What is the result of ${cause.toLowerCase().replace(/^the\s+/i, '')}?`,
          back: effect.charAt(0).toUpperCase() + effect.slice(1),
          type: 'concept',
        });
      }
      continue;
    }

    // "X leads to / causes Y"
    const causesMatch = sentence.match(
      /(.+?)\s+(?:leads?\s+to|causes?|results?\s+in|produces?|triggers?)\s+(.+)/i
    );
    if (causesMatch) {
      const cause = causesMatch[1].trim();
      const effect = causesMatch[2].trim().replace(/\.$/, '');
      if (cause.split(/\s+/).length <= 8 && effect.split(/\s+/).length >= 2) {
        cards.push({
          front: `What does ${cause.toLowerCase().replace(/^the\s+/i, '')} cause/lead to?`,
          back: effect.charAt(0).toUpperCase() + effect.slice(1),
          type: 'concept',
        });
      }
    }
  }

  return cards;
}

// ── Strategy 5: Keyword-based ──
// Find important terms and generate cards from their context

function extractKeywordCards(sentences: string[], existingFronts: Set<string>): Flashcard[] {
  const cards: Flashcard[] = [];

  // Find terms that appear capitalized (potential technical terms / proper nouns)
  const termContextMap = new Map<string, string>();

  for (const sentence of sentences) {
    // Find capitalized multi-word phrases (not at sentence start)
    const capitalizedTerms = sentence.match(/(?<=\s)[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) ?? [];
    for (const term of capitalizedTerms) {
      if (term.length >= 3 && !STOPWORDS.has(term.toLowerCase())) {
        if (!termContextMap.has(term)) {
          termContextMap.set(term, sentence);
        }
      }
    }

    // Find bold markers: **term** or __term__
    const boldTerms = sentence.match(/\*\*(.+?)\*\*|__(.+?)__/g) ?? [];
    for (const raw of boldTerms) {
      const term = raw.replace(/\*\*|__/g, '').trim();
      if (term.length >= 2 && !termContextMap.has(term)) {
        termContextMap.set(term, sentence.replace(/\*\*|__/g, ''));
      }
    }
  }

  // Generate cards for terms
  for (const [term, context] of termContextMap) {
    const question = `What is ${term}?`;
    if (existingFronts.has(question.toLowerCase())) continue;

    // Use the sentence as the answer, but remove the definition-like prefix if present
    let answer = context.trim().replace(/\.$/, '');
    if (answer.length > 200) answer = answer.slice(0, 200) + '...';

    cards.push({
      front: question,
      back: answer,
      type: 'concept',
    });
  }

  return cards;
}

// ── Equation / formula detection ──

function extractFormulas(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const sentence of sentences) {
    // Detect chemical/math equations: contains arrows or equals with chemical formulas
    const eqMatch = sentence.match(
      /(?:the\s+)?(?:overall\s+)?(?:equation|formula|reaction)\s+(?:for|of|is)\s+(.+?):\s*(.+)/i
    );
    if (eqMatch) {
      const subject = eqMatch[1].trim();
      const equation = eqMatch[2].trim().replace(/\.$/, '');
      cards.push({
        front: `What is the equation/formula for ${subject.toLowerCase()}?`,
        back: equation,
        type: 'fact',
      });
      continue;
    }

    // Standalone equations with arrows
    if (/[A-Z][a-z]?\d*.*[→+].*[A-Z][a-z]?\d*/.test(sentence)) {
      // Find the surrounding context
      const contextMatch = sentence.match(/(.+?):\s*(.+)/);
      if (contextMatch) {
        cards.push({
          front: `What is the equation for ${contextMatch[1].trim().toLowerCase()}?`,
          back: contextMatch[2].trim(),
          type: 'fact',
        });
      }
    }
  }

  return cards;
}

// ── "Which" / contrast detection ──

function extractContrasts(sentences: string[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // "X occurs in Y, while Z occurs in W"
    const contrastMatch = sentence.match(
      /(.+?)\s+(?:while|whereas|but|however|in contrast|on the other hand)\s+(.+)/i
    );
    if (contrastMatch) {
      const part1 = contrastMatch[1].trim().replace(/,\s*$/, '');
      const part2 = contrastMatch[2].trim().replace(/\.$/, '');
      if (part1.split(/\s+/).length >= 3 && part2.split(/\s+/).length >= 3) {
        cards.push({
          front: `What is the difference? ${part1.replace(/\.$/, '')}...`,
          back: `${part1}, while ${part2}`,
          type: 'concept',
        });
      }
    }
  }

  return cards;
}

// ── Deduplication ──

function dedup(cards: Flashcard[]): Flashcard[] {
  const seen = new Set<string>();
  const result: Flashcard[] = [];

  for (const card of cards) {
    const key = card.front.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(card);
  }

  return result;
}

// ── Main generation pipeline ──

export function generateCards(text: string): StudySet {
  const sentences = splitSentences(text);
  const title = extractTitle(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Run all strategies
  const definitions = extractDefinitions(sentences);
  const facts = extractFacts(sentences);
  const formulas = extractFormulas(sentences);
  const lists = extractLists(sentences, text);
  const causeEffect = extractCauseEffect(sentences);
  const contrasts = extractContrasts(sentences);

  // Collect existing fronts for keyword dedup
  const allSoFar = [...definitions, ...facts, ...formulas, ...lists, ...causeEffect, ...contrasts];
  const existingFronts = new Set(allSoFar.map(c => c.front.toLowerCase()));

  const keywords = extractKeywordCards(sentences, existingFronts);

  // Merge and dedup
  const allCards = dedup([
    ...definitions,
    ...facts,
    ...formulas,
    ...lists,
    ...causeEffect,
    ...contrasts,
    ...keywords,
  ]);

  // Cap at 20 cards
  const cards = allCards.slice(0, 20);

  return { title, cards, source: 'text', wordCount };
}

// ── Audio-based generation (wraps Whisper + text generator) ──

let whisperWorker: Worker | null = null;
let whisperReady = false;

export function isWhisperReady(): boolean {
  return whisperReady;
}

export function initWhisper(onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = new Worker('./whisper-worker.js', { type: 'module' });
    whisperWorker = w;
    w.onmessage = (e) => {
      if (e.data.type === 'progress') onProgress(e.data.pct);
      if (e.data.type === 'ready') {
        whisperReady = true;
        resolve();
      }
      if (e.data.type === 'error') reject(new Error(e.data.error));
    };
    w.postMessage({ type: 'init' });
  });
}

export function generateFromAudio(audioBlob: Blob): Promise<StudySet> {
  return new Promise((resolve, reject) => {
    if (!whisperWorker || !whisperReady) {
      reject(new Error('Whisper not loaded'));
      return;
    }
    const blobUrl = URL.createObjectURL(audioBlob);
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        whisperWorker!.removeEventListener('message', handler);
        const set = generateCards(e.data.text);
        set.source = 'audio';
        resolve(set);
      }
      if (e.data.type === 'error') {
        whisperWorker!.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    whisperWorker.addEventListener('message', handler);
    whisperWorker.postMessage({ type: 'transcribe', id: crypto.randomUUID(), audio: blobUrl });
  });
}

// ── Demo text ──

export const DEMO_TEXT = `Photosynthesis is the process by which green plants convert sunlight into chemical energy. It occurs primarily in the leaves, specifically in organelles called chloroplasts. The process requires water, carbon dioxide, and light energy.

There are two main stages: the light-dependent reactions and the Calvin cycle. The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH. The Calvin cycle takes place in the stroma and uses these products to fix carbon dioxide into glucose.

Chlorophyll is the primary pigment responsible for absorbing light energy. It absorbs red and blue wavelengths most efficiently, which is why plants appear green. Other accessory pigments include carotenoids and phycobilins.

The overall equation for photosynthesis is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. This means six molecules of carbon dioxide and six molecules of water are converted into one molecule of glucose and six molecules of oxygen.`;
