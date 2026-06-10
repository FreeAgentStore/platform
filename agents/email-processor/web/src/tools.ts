import type { Tool } from './agent-loop';

// Module-level state
interface Email {
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  category?: string;
  actionItems: string[];
  draftReply?: string;
}

let emails: Email[] = [];
let actionItems: Array<{ emailIndex: number; action: string; due?: string }> = [];

function parseEmailBlock(block: string): Email {
  const fromMatch = block.match(/^From:\s*(.+)$/im);
  const toMatch = block.match(/^To:\s*(.+)$/im);
  const subjectMatch = block.match(/^Subject:\s*(.+)$/im);
  const dateMatch = block.match(/^Date:\s*(.+)$/im);

  const from = fromMatch?.[1]?.trim() ?? 'Unknown';
  const to = toMatch?.[1]?.trim() ?? '';
  const subject = subjectMatch?.[1]?.trim() ?? 'No Subject';
  const date = dateMatch?.[1]?.trim() ?? '';

  // Body is everything after the headers (first blank line after headers)
  let body = block;
  const headerEnd = block.search(/\n\s*\n/);
  if (headerEnd !== -1) {
    body = block.slice(headerEnd).trim();
  } else {
    // If no clear header/body separation, remove matched header lines
    body = block
      .replace(/^From:\s*.+$/im, '')
      .replace(/^To:\s*.+$/im, '')
      .replace(/^Subject:\s*.+$/im, '')
      .replace(/^Date:\s*.+$/im, '')
      .trim();
  }

  return { from, to, subject, date, body, actionItems: [] };
}

export const AGENT_TOOLS: Tool[] = [
  {
    name: 'load_emails',
    description: 'Parses raw email text into individual emails. Splits on common delimiters (\"From:\", \"----\", blank lines between emails). Extracts from, to, subject, date, body for each. Stores in memory and returns count + summary.',
    parameters: {
      text: { type: 'string', description: 'Raw email text containing one or more emails' },
    },
    execute: async (params) => {
      const text = String(params.text);

      // Try splitting on common email delimiters
      let blocks: string[] = [];

      // Strategy 1: Split on "From:" at start of line (common in mbox/forwarded)
      const fromSplit = text.split(/(?=^From:\s)/im).filter((b) => b.trim().length > 0);
      if (fromSplit.length > 1) {
        blocks = fromSplit;
      } else {
        // Strategy 2: Split on separator lines (----, ====, etc.)
        const sepSplit = text.split(/\n-{4,}\n|\n={4,}\n|\n\*{4,}\n/).filter((b) => b.trim().length > 0);
        if (sepSplit.length > 1) {
          blocks = sepSplit;
        } else {
          // Strategy 3: Treat entire text as one email
          blocks = [text];
        }
      }

      const parsed = blocks.map((block) => parseEmailBlock(block.trim()));
      emails = [...emails, ...parsed];

      const summary = parsed
        .map((e, i) => `  ${emails.length - parsed.length + i}: [${e.from}] ${e.subject}`)
        .join('\n');

      return `Loaded ${parsed.length} email(s). Total emails: ${emails.length}.\n\n${summary}`;
    },
  },

  {
    name: 'load_email_file',
    description: 'Opens a file picker for the user to upload a .txt, .eml, .mbox, or .csv file containing emails. Parses and stores them. For CSV, expects columns like from,subject,date,body.',
    parameters: {},
    execute: async () => {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Email files',
              accept: {
                'text/plain': ['.txt', '.eml', '.mbox'],
                'text/csv': ['.csv'],
              },
            },
          ],
        });

        const file = await fileHandle.getFile();
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

        let parsed: Email[] = [];

        if (ext === 'csv') {
          // Parse CSV: expect from,subject,date,body (or similar columns)
          const lines = text.split('\n');
          if (lines.length < 2) return 'CSV file is empty or has no data rows.';

          const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
          const fromIdx = headers.findIndex((h) => h.includes('from'));
          const subjectIdx = headers.findIndex((h) => h.includes('subject'));
          const dateIdx = headers.findIndex((h) => h.includes('date'));
          const bodyIdx = headers.findIndex((h) => h.includes('body') || h.includes('content') || h.includes('message'));
          const toIdx = headers.findIndex((h) => h.includes('to'));

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // Simple CSV split (doesn't handle quoted commas, but works for basic files)
            const cols = line.split(',');
            parsed.push({
              from: fromIdx >= 0 ? (cols[fromIdx]?.trim() ?? '') : '',
              to: toIdx >= 0 ? (cols[toIdx]?.trim() ?? '') : '',
              subject: subjectIdx >= 0 ? (cols[subjectIdx]?.trim() ?? '') : 'No Subject',
              date: dateIdx >= 0 ? (cols[dateIdx]?.trim() ?? '') : '',
              body: bodyIdx >= 0 ? (cols[bodyIdx]?.trim() ?? '') : '',
              actionItems: [],
            });
          }
        } else {
          // .txt, .eml, .mbox — split on "From:" or separators
          const blocks = text.split(/(?=^From:\s)/im).filter((b) => b.trim().length > 0);
          if (blocks.length > 0) {
            parsed = blocks.map((block) => parseEmailBlock(block.trim()));
          } else {
            parsed = [parseEmailBlock(text)];
          }
        }

        emails = [...emails, ...parsed];

        const summary = parsed
          .map((e, i) => `  ${emails.length - parsed.length + i}: [${e.from}] ${e.subject}`)
          .join('\n');

        return `Loaded ${parsed.length} email(s) from "${file.name}". Total emails: ${emails.length}.\n\n${summary}`;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return 'File picker was cancelled by user.';
        }
        return `Error loading file: ${err.message}`;
      }
    },
  },

  {
    name: 'get_email',
    description: 'Returns the full content of an email by its 0-based index.',
    parameters: {
      index: { type: 'number', description: 'The 0-based index of the email to retrieve' },
    },
    execute: async (params) => {
      const index = Number(params.index);

      if (index < 0 || index >= emails.length) {
        return `Error: Invalid index ${index}. Valid range: 0-${emails.length - 1}. Total emails: ${emails.length}.`;
      }

      const e = emails[index];
      return [
        `From: ${e.from}`,
        `To: ${e.to}`,
        `Subject: ${e.subject}`,
        `Date: ${e.date}`,
        e.category ? `Category: ${e.category}` : null,
        e.draftReply ? `Draft Reply: ${e.draftReply}` : null,
        e.actionItems.length > 0 ? `Action Items:\n${e.actionItems.map((a) => `  - ${a}`).join('\n')}` : null,
        '',
        e.body,
      ].filter((line) => line !== null).join('\n');
    },
  },

  {
    name: 'categorize_email',
    description: 'Tags an email with a category: urgent, action-required, informational, promotional, or spam.',
    parameters: {
      index: { type: 'number', description: 'The 0-based index of the email to categorize' },
      category: { type: 'string', description: 'Category: "urgent", "action-required", "informational", "promotional", or "spam"' },
    },
    execute: async (params) => {
      const index = Number(params.index);
      const category = String(params.category);

      if (index < 0 || index >= emails.length) {
        return `Error: Invalid index ${index}. Valid range: 0-${emails.length - 1}.`;
      }

      const validCategories = ['urgent', 'action-required', 'informational', 'promotional', 'spam'];
      if (!validCategories.includes(category)) {
        return `Error: Invalid category "${category}". Valid: ${validCategories.join(', ')}.`;
      }

      emails[index].category = category;
      return `Email ${index} ("${emails[index].subject}") categorized as: ${category}`;
    },
  },

  {
    name: 'add_action_item',
    description: 'Adds an action item linked to a specific email. Optionally includes a due date.',
    parameters: {
      email_index: { type: 'number', description: 'The 0-based index of the related email' },
      action: { type: 'string', description: 'The action item text' },
      due: { type: 'string', description: 'Optional due date for the action', required: false },
    },
    execute: async (params) => {
      const emailIndex = Number(params.email_index);
      const action = String(params.action);
      const due = params.due ? String(params.due) : undefined;

      if (emailIndex < 0 || emailIndex >= emails.length) {
        return `Error: Invalid email index ${emailIndex}. Valid range: 0-${emails.length - 1}.`;
      }

      const item = { emailIndex, action, due };
      actionItems.push(item);
      emails[emailIndex].actionItems.push(due ? `${action} (due: ${due})` : action);

      const allItems = actionItems
        .map((a, i) => `  ${i + 1}. [Email ${a.emailIndex}] ${a.action}${a.due ? ` (due: ${a.due})` : ''}`)
        .join('\n');

      return `Action item added. Total action items: ${actionItems.length}.\n\n${allItems}`;
    },
  },

  {
    name: 'draft_reply',
    description: 'Stores a draft reply for a specific email.',
    parameters: {
      email_index: { type: 'number', description: 'The 0-based index of the email to reply to' },
      reply: { type: 'string', description: 'The draft reply text' },
    },
    execute: async (params) => {
      const emailIndex = Number(params.email_index);
      const reply = String(params.reply);

      if (emailIndex < 0 || emailIndex >= emails.length) {
        return `Error: Invalid email index ${emailIndex}. Valid range: 0-${emails.length - 1}.`;
      }

      emails[emailIndex].draftReply = reply;

      return `Draft reply saved for email ${emailIndex} ("${emails[emailIndex].subject}").\n\nDraft:\n${reply}`;
    },
  },

  {
    name: 'get_summary',
    description: 'Returns a full inbox summary: total emails, breakdown by category, all action items, and all draft replies.',
    parameters: {},
    execute: async () => {
      if (emails.length === 0) {
        return 'No emails loaded. Use load_emails or load_email_file to add emails.';
      }

      // Category breakdown
      const categories: Record<string, number> = {};
      let uncategorized = 0;
      for (const e of emails) {
        if (e.category) {
          categories[e.category] = (categories[e.category] ?? 0) + 1;
        } else {
          uncategorized++;
        }
      }

      const categoryLines = Object.entries(categories)
        .map(([cat, count]) => `  ${cat}: ${count}`)
        .join('\n');

      // Action items
      const actionLines = actionItems.length > 0
        ? actionItems
            .map((a) => `  - [Email ${a.emailIndex}: "${emails[a.emailIndex]?.subject ?? '?'}"] ${a.action}${a.due ? ` (due: ${a.due})` : ''}`)
            .join('\n')
        : '  None';

      // Draft replies
      const drafts = emails
        .map((e, i) => e.draftReply ? `  - Email ${i} ("${e.subject}"): ${e.draftReply.slice(0, 100)}${e.draftReply.length > 100 ? '...' : ''}` : null)
        .filter(Boolean);
      const draftLines = drafts.length > 0 ? drafts.join('\n') : '  None';

      // Email list
      const emailList = emails
        .map((e, i) => `  ${i}. [${e.category ?? 'uncategorized'}] ${e.from} \u2014 ${e.subject}`)
        .join('\n');

      return [
        `INBOX SUMMARY`,
        `=============`,
        `Total emails: ${emails.length}`,
        ``,
        `By category:`,
        categoryLines || '  None categorized',
        uncategorized > 0 ? `  uncategorized: ${uncategorized}` : '',
        ``,
        `Action items (${actionItems.length}):`,
        actionLines,
        ``,
        `Draft replies (${drafts.length}):`,
        draftLines,
        ``,
        `All emails:`,
        emailList,
      ].filter((line) => line !== null).join('\n');
    },
  },

  {
    name: 'export_summary',
    description: 'Compiles the full summary (categories, action items, drafts) into a downloadable text file. Triggers a browser download.',
    parameters: {},
    execute: async () => {
      if (emails.length === 0) {
        return 'No emails to export. Load emails first.';
      }

      // Build a comprehensive export
      const lines: string[] = [
        'EMAIL PROCESSING SUMMARY',
        `Generated: ${new Date().toISOString()}`,
        `Total emails: ${emails.length}`,
        '',
        '========================================',
        'EMAILS BY CATEGORY',
        '========================================',
        '',
      ];

      const byCategory: Record<string, Email[]> = {};
      for (const e of emails) {
        const cat = e.category ?? 'uncategorized';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(e);
      }

      for (const [cat, catEmails] of Object.entries(byCategory)) {
        lines.push(`--- ${cat.toUpperCase()} (${catEmails.length}) ---`);
        for (const e of catEmails) {
          lines.push(`  From: ${e.from}`);
          lines.push(`  Subject: ${e.subject}`);
          lines.push(`  Date: ${e.date}`);
          if (e.actionItems.length > 0) {
            lines.push(`  Action Items:`);
            for (const a of e.actionItems) {
              lines.push(`    - ${a}`);
            }
          }
          if (e.draftReply) {
            lines.push(`  Draft Reply:`);
            lines.push(`    ${e.draftReply}`);
          }
          lines.push('');
        }
      }

      lines.push('========================================');
      lines.push('ALL ACTION ITEMS');
      lines.push('========================================');
      lines.push('');
      if (actionItems.length === 0) {
        lines.push('  None');
      } else {
        for (const a of actionItems) {
          const email = emails[a.emailIndex];
          lines.push(`  - ${a.action}${a.due ? ` (due: ${a.due})` : ''}`);
          lines.push(`    From: ${email?.from ?? '?'} | Subject: ${email?.subject ?? '?'}`);
        }
      }

      const content = lines.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-summary-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return `Exported summary as text file download.\n\n${emails.length} emails, ${actionItems.length} action items, ${emails.filter((e) => e.draftReply).length} draft replies.`;
    },
  },
];
