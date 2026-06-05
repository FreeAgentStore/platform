/**
 * Meeting summarizer — combines Whisper transcript with heuristic analysis
 * to extract speaker turns, decisions, action items, key points, and topics.
 */

export interface SpeakerTurn {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface ActionItem {
  text: string;
  assignee: string | null;
  deadline: string | null;
}

export interface MeetingResult {
  transcript: string;
  duration: number;
  turns: SpeakerTurn[];
  decisions: string[];
  actionItems: ActionItem[];
  keyPoints: string[];
  topics: string[];
  wordCount: number;
}

// ── Stopwords for TF-IDF topic extraction ──

const STOPWORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if',
  'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above',
  'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's',
  't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're',
  've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven',
  'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren',
  'won', 'wouldn', 'also', 'well', 'get', 'got', 'going', 'go', 'come', 'came',
  'thing', 'things', 'think', 'know', 'like', 'yeah', 'okay', 'ok', 'um', 'uh',
  'right', 'let', 'say', 'said', 'one', 'two', 'would', 'could', 'make', 'made',
  'really', 'actually', 'basically', 'kind', 'sort', 'lot', 'way', 'want',
]);

// ── Decision detection patterns ──

const DECISION_PATTERNS = [
  /\b(?:we(?:'ve)?|they|the team)\s+(?:decided|agreed|concluded)\b/i,
  /\b(?:we'll|we\s+will)\s+go\s+with\b/i,
  /\bthe\s+plan\s+is\b/i,
  /\blet'?s\s+do\b/i,
  /\blet'?s\s+go\s+(?:with|ahead|for)\b/i,
  /\bconclusion\s+is\b/i,
  /\b(?:approved|settled\s+on|finalized)\b/i,
  /\bwe(?:'re| are)\s+going\s+(?:to|with)\b/i,
  /\bfinal\s+(?:decision|answer|call)\b/i,
  /\bso\s+(?:we'll|we\s+will|the\s+plan)\b/i,
];

// ── Action item detection patterns ──

const ACTION_PATTERNS = [
  /\bwill\s+(?:need\s+to\s+)?(?:\w+)/i,
  /\bshould\s+\w+/i,
  /\bneed(?:s)?\s+to\s+\w+/i,
  /\bhas\s+to\s+\w+/i,
  /\bhave\s+to\s+\w+/i,
  /\baction\s+item/i,
  /\btodo\b/i,
  /\bfollow\s+up\b/i,
  /\btake\s+care\s+of\b/i,
  /\bresponsible\s+for\b/i,
  /\bmake\s+sure\b/i,
  /\bplease\s+\w+/i,
  /\bcan\s+you\s+\w+/i,
  /\bdon'?t\s+forget\s+to\b/i,
  /\bremember\s+to\b/i,
];

// ── Name detection: capitalized words that look like names ──

const COMMON_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'david', 'richard', 'joseph', 'thomas',
  'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald',
  'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian', 'george',
  'timothy', 'ronald', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary',
  'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon',
  'benjamin', 'samuel', 'raymond', 'gregory', 'frank', 'alexander', 'patrick',
  'jack', 'dennis', 'jerry', 'tyler', 'aaron', 'jose', 'adam', 'nathan', 'henry',
  'peter', 'zachary', 'douglas', 'harold', 'kyle', 'noah', 'sean',
  'mary', 'patricia', 'jennifer', 'linda', 'barbara', 'elizabeth', 'susan',
  'jessica', 'sarah', 'karen', 'lisa', 'nancy', 'betty', 'margaret', 'sandra',
  'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle', 'carol',
  'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura',
  'cynthia', 'kathleen', 'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela',
  'emma', 'nicole', 'helen', 'samantha', 'katherine', 'christine', 'debra',
  'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather', 'diane', 'ruth',
  'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina',
  'joan', 'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline',
  'martha', 'gloria', 'teresa', 'ann', 'sara', 'madison', 'frances', 'kathryn',
  'janice', 'jean', 'abigail', 'alice', 'judy', 'sophia', 'grace', 'denise',
  'amber', 'doris', 'marilyn', 'danielle', 'beverly', 'isabella', 'theresa',
  'diana', 'natalie', 'brittany', 'charlotte', 'marie', 'kayla', 'alexis', 'lori',
]);

// ── Deadline patterns ──

const DEADLINE_PATTERNS = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bby\s+(next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\bbefore\s+(next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\bdue\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bdue\s+(next\s+(?:week|month))\b/i,
  /\b(?:by|before|due)\s+((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})\b/i,
  /\bby\s+(end\s+of\s+(?:day|week|month|quarter|year))\b/i,
  /\bby\s+(eod|eow|eom)\b/i,
  /\bwithin\s+(\d+\s+(?:days?|weeks?|hours?))\b/i,
  /\b(tomorrow|tonight|today)\b/i,
];

// ── Key point patterns ──

const KEYPOINT_PATTERNS = [
  /\b(?:important(?:ly)?|key\s+(?:point|takeaway|finding)|critical(?:ly)?|note\s+that|remember\s+that|keep\s+in\s+mind)\b/i,
  /\b(?:the\s+main|the\s+biggest|the\s+most\s+important|the\s+key)\b/i,
  /\b(?:highlight|emphasize|stress|underline|worth\s+noting)\b/i,
  /\b(?:bottom\s+line|in\s+summary|to\s+summarize|in\s+short)\b/i,
];

// ── Sentence splitting ──

function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

// ── Name extraction from a sentence ──

function extractName(sentence: string): string | null {
  const words = sentence.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-zA-Z]/g, '');
    if (clean.length >= 2 && COMMON_NAMES.has(clean.toLowerCase())) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
  }
  return null;
}

// ── Deadline extraction from a sentence ──

function extractDeadline(sentence: string): string | null {
  for (const pattern of DEADLINE_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) return match[1] || match[0];
  }
  return null;
}

// ── Speaker turn detection from word-level timestamps ──

interface WordChunk {
  text: string;
  timestamp: [number, number | null];
}

function detectSpeakerTurns(chunks: WordChunk[]): SpeakerTurn[] {
  if (chunks.length === 0) return [];

  const PAUSE_THRESHOLD = 1.5; // seconds — gap suggesting speaker change
  const turns: SpeakerTurn[] = [];
  let currentSpeaker = 0;
  let turnWords: string[] = [];
  let turnStart = chunks[0].timestamp[0];
  let lastEnd = chunks[0].timestamp[1] ?? chunks[0].timestamp[0];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const wordStart = chunk.timestamp[0];
    const wordEnd = chunk.timestamp[1] ?? wordStart;
    const gap = wordStart - lastEnd;

    if (gap > PAUSE_THRESHOLD && turnWords.length > 0) {
      // End current turn
      turns.push({
        speaker: `Speaker ${(currentSpeaker % 2) + 1}`,
        text: turnWords.join(' ').trim(),
        startTime: turnStart,
        endTime: lastEnd,
      });
      // Switch speaker
      currentSpeaker++;
      turnWords = [];
      turnStart = wordStart;
    }

    turnWords.push(chunk.text.trim());
    lastEnd = wordEnd;
  }

  // Push final turn
  if (turnWords.length > 0) {
    turns.push({
      speaker: `Speaker ${(currentSpeaker % 2) + 1}`,
      text: turnWords.join(' ').trim(),
      startTime: turnStart,
      endTime: lastEnd,
    });
  }

  return turns;
}

// ── Decision extraction ──

function extractDecisions(sentences: string[]): string[] {
  const decisions: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    for (const pattern of DECISION_PATTERNS) {
      if (pattern.test(s)) {
        decisions.push(s);
        break;
      }
    }
    // Also check: sentences after "so" or "alright" containing action verbs
    if (i > 0) {
      const prev = sentences[i - 1].toLowerCase().trim();
      if (/^(?:so|alright|all right|okay|ok)\b/.test(prev)) {
        if (/\b(?:will|going to|plan to|start|launch|build|create|move|ship|deploy|send|schedule)\b/i.test(s)) {
          if (!decisions.includes(s)) decisions.push(s);
        }
      }
    }
  }
  return decisions;
}

// ── Action item extraction ──

function extractActionItems(sentences: string[]): ActionItem[] {
  const items: ActionItem[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    let isAction = false;
    for (const pattern of ACTION_PATTERNS) {
      if (pattern.test(sentence)) {
        isAction = true;
        break;
      }
    }
    if (!isAction) continue;

    const normalized = sentence.replace(/\s+/g, ' ').trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const assignee = extractName(sentence);
    const deadline = extractDeadline(sentence);

    items.push({ text: sentence, assignee, deadline });
  }

  return items;
}

// ── Key point extraction ──

function extractKeyPoints(sentences: string[], turns: SpeakerTurn[]): string[] {
  const points: string[] = [];
  const seen = new Set<string>();

  // Sentences with emphasis markers
  for (const s of sentences) {
    for (const pattern of KEYPOINT_PATTERNS) {
      if (pattern.test(s) && !seen.has(s)) {
        seen.add(s);
        points.push(s);
        break;
      }
    }
  }

  // First sentence of each speaker turn as potential key point
  for (const turn of turns) {
    const turnSentences = splitSentences(turn.text);
    if (turnSentences.length > 0) {
      const first = turnSentences[0];
      // Only add if it's substantial (> 8 words) and not already captured
      if (first.split(/\s+/).length > 8 && !seen.has(first)) {
        seen.add(first);
        points.push(first);
      }
    }
  }

  // Limit to top 10
  return points.slice(0, 10);
}

// ── Topic extraction (TF-IDF style) ──

function extractTopics(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();

  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Sort by frequency, take top terms
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Group consecutive or related terms into topics
  // Simple approach: just return the top distinct terms as topics
  const topics: string[] = [];
  for (const [term, count] of sorted) {
    if (count >= 2 && topics.length < 8) {
      topics.push(term);
    }
  }

  // If we don't have enough from frequency, add single-occurrence terms
  if (topics.length < 3) {
    for (const [term] of sorted) {
      if (!topics.includes(term) && topics.length < 5) {
        topics.push(term);
      }
    }
  }

  return topics;
}

// ── Main summarization pipeline ──

export function analyzeMeeting(
  transcript: string,
  chunks: WordChunk[],
): MeetingResult {
  const sentences = splitSentences(transcript);
  const turns = detectSpeakerTurns(chunks);
  const decisions = extractDecisions(sentences);
  const actionItems = extractActionItems(sentences);
  const keyPoints = extractKeyPoints(sentences, turns);
  const topics = extractTopics(transcript);

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const duration = chunks.length > 0
    ? (chunks[chunks.length - 1].timestamp[1] ?? chunks[chunks.length - 1].timestamp[0])
    : 0;

  return {
    transcript,
    duration,
    turns,
    decisions,
    actionItems,
    keyPoints,
    topics,
    wordCount,
  };
}
