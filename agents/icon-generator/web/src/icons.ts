export interface IconDef {
  name: string;
  keywords: string[];
  category: string;
  svg: (primary: string, secondary: string) => string;
}

const icon = (
  name: string,
  keywords: string[],
  category: string,
  pathFn: (p: string, s: string) => string,
): IconDef => ({
  name,
  keywords,
  category,
  svg: (primary: string, secondary: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${pathFn(primary, secondary)}</svg>`,
});

export const CATEGORIES = [
  'UI',
  'Communication',
  'Media',
  'Social',
  'Nature',
  'Tech',
  'Objects',
  'Shapes',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const ICONS: IconDef[] = [
  // ── UI ──────────────────────────────────────────────────────────────
  icon('home', ['home', 'house', 'building', 'main', 'homepage'], 'UI', (p) =>
    `<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke="${p}"/><polyline points="9 21 9 14 15 14 15 21" stroke="${p}"/>`,
  ),
  icon('settings', ['settings', 'gear', 'cog', 'preferences', 'config', 'options'], 'UI', (p) =>
    `<circle cx="12" cy="12" r="3" stroke="${p}"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="${p}"/>`,
  ),
  icon('search', ['search', 'find', 'magnify', 'lookup', 'lens'], 'UI', (p) =>
    `<circle cx="11" cy="11" r="8" stroke="${p}"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="${p}"/>`,
  ),
  icon('menu', ['menu', 'hamburger', 'navigation', 'nav', 'bars', 'lines'], 'UI', (p) =>
    `<line x1="3" y1="6" x2="21" y2="6" stroke="${p}"/><line x1="3" y1="12" x2="21" y2="12" stroke="${p}"/><line x1="3" y1="18" x2="21" y2="18" stroke="${p}"/>`,
  ),
  icon('close', ['close', 'x', 'cancel', 'dismiss', 'remove', 'delete', 'cross'], 'UI', (p) =>
    `<line x1="18" y1="6" x2="6" y2="18" stroke="${p}"/><line x1="6" y1="6" x2="18" y2="18" stroke="${p}"/>`,
  ),
  icon('check', ['check', 'checkmark', 'tick', 'done', 'complete', 'success', 'ok', 'yes', 'confirm'], 'UI', (p) =>
    `<polyline points="20 6 9 17 4 12" stroke="${p}"/>`,
  ),
  icon('plus', ['plus', 'add', 'new', 'create', 'positive'], 'UI', (p) =>
    `<line x1="12" y1="5" x2="12" y2="19" stroke="${p}"/><line x1="5" y1="12" x2="19" y2="12" stroke="${p}"/>`,
  ),
  icon('minus', ['minus', 'subtract', 'remove', 'negative', 'dash'], 'UI', (p) =>
    `<line x1="5" y1="12" x2="19" y2="12" stroke="${p}"/>`,
  ),
  icon('arrow-left', ['arrow-left', 'back', 'previous', 'left'], 'UI', (p) =>
    `<line x1="19" y1="12" x2="5" y2="12" stroke="${p}"/><polyline points="12 19 5 12 12 5" stroke="${p}"/>`,
  ),
  icon('arrow-right', ['arrow-right', 'forward', 'next', 'right'], 'UI', (p) =>
    `<line x1="5" y1="12" x2="19" y2="12" stroke="${p}"/><polyline points="12 5 19 12 12 19" stroke="${p}"/>`,
  ),
  icon('arrow-up', ['arrow-up', 'up', 'top'], 'UI', (p) =>
    `<line x1="12" y1="19" x2="12" y2="5" stroke="${p}"/><polyline points="5 12 12 5 19 12" stroke="${p}"/>`,
  ),
  icon('arrow-down', ['arrow-down', 'down', 'bottom'], 'UI', (p) =>
    `<line x1="12" y1="5" x2="12" y2="19" stroke="${p}"/><polyline points="19 12 12 19 5 12" stroke="${p}"/>`,
  ),
  icon('refresh', ['refresh', 'reload', 'sync', 'rotate', 'update', 'retry'], 'UI', (p) =>
    `<polyline points="23 4 23 10 17 10" stroke="${p}"/><polyline points="1 20 1 14 7 14" stroke="${p}"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="${p}"/>`,
  ),
  icon('download', ['download', 'save', 'export', 'get'], 'UI', (p) =>
    `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="${p}"/><polyline points="7 10 12 15 17 10" stroke="${p}"/><line x1="12" y1="15" x2="12" y2="3" stroke="${p}"/>`,
  ),
  icon('upload', ['upload', 'import', 'publish', 'send-up'], 'UI', (p) =>
    `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="${p}"/><polyline points="17 8 12 3 7 8" stroke="${p}"/><line x1="12" y1="3" x2="12" y2="15" stroke="${p}"/>`,
  ),
  icon('share', ['share', 'forward', 'distribute', 'spread'], 'UI', (p) =>
    `<circle cx="18" cy="5" r="3" stroke="${p}"/><circle cx="6" cy="12" r="3" stroke="${p}"/><circle cx="18" cy="19" r="3" stroke="${p}"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="${p}"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="${p}"/>`,
  ),
  icon('link', ['link', 'chain', 'url', 'anchor', 'connect'], 'UI', (p) =>
    `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="${p}"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="${p}"/>`,
  ),
  icon('edit', ['edit', 'pencil', 'write', 'compose', 'modify', 'pen'], 'UI', (p) =>
    `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="${p}"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="${p}"/>`,
  ),
  icon('trash', ['trash', 'delete', 'remove', 'bin', 'garbage', 'discard'], 'UI', (p) =>
    `<polyline points="3 6 5 6 21 6" stroke="${p}"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="${p}"/><line x1="10" y1="11" x2="10" y2="17" stroke="${p}"/><line x1="14" y1="11" x2="14" y2="17" stroke="${p}"/>`,
  ),
  icon('copy', ['copy', 'duplicate', 'clone', 'clipboard'], 'UI', (p) =>
    `<rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="${p}"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="${p}"/>`,
  ),
  icon('save', ['save', 'floppy', 'disk', 'store', 'persist'], 'UI', (p) =>
    `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="${p}"/><polyline points="17 21 17 13 7 13 7 21" stroke="${p}"/><polyline points="7 3 7 8 15 8" stroke="${p}"/>`,
  ),
  icon('undo', ['undo', 'back', 'revert', 'rollback'], 'UI', (p) =>
    `<polyline points="1 4 1 10 7 10" stroke="${p}"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="${p}"/>`,
  ),
  icon('redo', ['redo', 'forward', 'repeat'], 'UI', (p) =>
    `<polyline points="23 4 23 10 17 10" stroke="${p}"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="${p}"/>`,
  ),

  // ── Communication ───────────────────────────────────────────────────
  icon('mail', ['mail', 'email', 'envelope', 'letter', 'message', 'inbox'], 'Communication', (p) =>
    `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="${p}"/><polyline points="22 6 12 13 2 6" stroke="${p}"/>`,
  ),
  icon('chat', ['chat', 'message', 'bubble', 'comment', 'conversation', 'talk', 'speech'], 'Communication', (p) =>
    `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="${p}"/>`,
  ),
  icon('phone', ['phone', 'call', 'telephone', 'mobile', 'dial', 'contact'], 'Communication', (p) =>
    `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" stroke="${p}"/>`,
  ),
  icon('bell', ['bell', 'notification', 'alert', 'alarm', 'ring', 'notify'], 'Communication', (p) =>
    `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="${p}"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="${p}"/>`,
  ),
  icon('megaphone', ['megaphone', 'announce', 'broadcast', 'speaker', 'shout', 'promotion', 'marketing'], 'Communication', (p) =>
    `<path d="M3 11l18-5v12L3 13v-2z" stroke="${p}"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" stroke="${p}"/>`,
  ),
  icon('send', ['send', 'submit', 'paper-plane', 'dispatch', 'deliver'], 'Communication', (p) =>
    `<line x1="22" y1="2" x2="11" y2="13" stroke="${p}"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke="${p}"/>`,
  ),

  // ── Media ───────────────────────────────────────────────────────────
  icon('play', ['play', 'start', 'video', 'begin', 'resume', 'watch'], 'Media', (p) =>
    `<polygon points="5 3 19 12 5 21 5 3" stroke="${p}"/>`,
  ),
  icon('pause', ['pause', 'wait', 'hold', 'stop-temp'], 'Media', (p) =>
    `<rect x="6" y="4" width="4" height="16" stroke="${p}"/><rect x="14" y="4" width="4" height="16" stroke="${p}"/>`,
  ),
  icon('stop', ['stop', 'end', 'halt', 'terminate'], 'Media', (p) =>
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="${p}"/>`,
  ),
  icon('volume', ['volume', 'sound', 'audio', 'speaker', 'loud'], 'Media', (p) =>
    `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="${p}"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="${p}"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="${p}"/>`,
  ),
  icon('mic', ['mic', 'microphone', 'record', 'voice', 'audio-input', 'podcast'], 'Media', (p) =>
    `<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="${p}"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="${p}"/><line x1="12" y1="19" x2="12" y2="23" stroke="${p}"/><line x1="8" y1="23" x2="16" y2="23" stroke="${p}"/>`,
  ),
  icon('camera', ['camera', 'photo', 'picture', 'snap', 'photograph', 'lens'], 'Media', (p) =>
    `<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="${p}"/><circle cx="12" cy="13" r="4" stroke="${p}"/>`,
  ),
  icon('image', ['image', 'photo', 'picture', 'gallery', 'landscape'], 'Media', (p) =>
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="${p}"/><circle cx="8.5" cy="8.5" r="1.5" stroke="${p}"/><polyline points="21 15 16 10 5 21" stroke="${p}"/>`,
  ),
  icon('film', ['film', 'movie', 'cinema', 'video', 'reel', 'footage'], 'Media', (p) =>
    `<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" stroke="${p}"/><line x1="7" y1="2" x2="7" y2="22" stroke="${p}"/><line x1="17" y1="2" x2="17" y2="22" stroke="${p}"/><line x1="2" y1="12" x2="22" y2="12" stroke="${p}"/><line x1="2" y1="7" x2="7" y2="7" stroke="${p}"/><line x1="2" y1="17" x2="7" y2="17" stroke="${p}"/><line x1="17" y1="7" x2="22" y2="7" stroke="${p}"/><line x1="17" y1="17" x2="22" y2="17" stroke="${p}"/>`,
  ),
  icon('music', ['music', 'note', 'song', 'audio', 'tune', 'melody', 'sound'], 'Media', (p) =>
    `<path d="M9 18V5l12-2v13" stroke="${p}"/><circle cx="6" cy="18" r="3" stroke="${p}"/><circle cx="18" cy="16" r="3" stroke="${p}"/>`,
  ),

  // ── Social ──────────────────────────────────────────────────────────
  icon('heart', ['heart', 'love', 'like', 'favorite', 'romance', 'health'], 'Social', (p) =>
    `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="${p}"/>`,
  ),
  icon('star', ['star', 'favorite', 'rating', 'rate', 'review', 'featured'], 'Social', (p) =>
    `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="${p}"/>`,
  ),
  icon('thumbs-up', ['thumbs-up', 'like', 'approve', 'good', 'agree', 'positive', 'thumb'], 'Social', (p) =>
    `<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" stroke="${p}"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="${p}"/>`,
  ),
  icon('user', ['user', 'person', 'profile', 'account', 'avatar', 'people', 'human'], 'Social', (p) =>
    `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="${p}"/><circle cx="12" cy="7" r="4" stroke="${p}"/>`,
  ),
  icon('users', ['users', 'people', 'group', 'team', 'community', 'members'], 'Social', (p) =>
    `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="${p}"/><circle cx="9" cy="7" r="4" stroke="${p}"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="${p}"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="${p}"/>`,
  ),
  icon('bookmark', ['bookmark', 'save', 'read-later', 'tag', 'mark', 'pin'], 'Social', (p) =>
    `<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="${p}"/>`,
  ),

  // ── Nature ──────────────────────────────────────────────────────────
  icon('sun', ['sun', 'bright', 'day', 'light', 'solar', 'sunshine', 'weather', 'warm'], 'Nature', (p) =>
    `<circle cx="12" cy="12" r="5" stroke="${p}"/><line x1="12" y1="1" x2="12" y2="3" stroke="${p}"/><line x1="12" y1="21" x2="12" y2="23" stroke="${p}"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="${p}"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="${p}"/><line x1="1" y1="12" x2="3" y2="12" stroke="${p}"/><line x1="21" y1="12" x2="23" y2="12" stroke="${p}"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="${p}"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="${p}"/>`,
  ),
  icon('moon', ['moon', 'night', 'dark', 'sleep', 'crescent', 'lunar'], 'Nature', (p) =>
    `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="${p}"/>`,
  ),
  icon('cloud', ['cloud', 'sky', 'weather', 'overcast', 'storage', 'hosting'], 'Nature', (p) =>
    `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="${p}"/>`,
  ),
  icon('rain', ['rain', 'weather', 'water', 'drizzle', 'shower', 'wet'], 'Nature', (p, s) =>
    `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" stroke="${p}"/><line x1="8" y1="21" x2="8" y2="23" stroke="${s}"/><line x1="12" y1="21" x2="12" y2="23" stroke="${s}"/><line x1="16" y1="21" x2="16" y2="23" stroke="${s}"/>`,
  ),
  icon('snow', ['snow', 'snowflake', 'winter', 'cold', 'ice', 'freeze', 'frost'], 'Nature', (p) =>
    `<line x1="12" y1="2" x2="12" y2="22" stroke="${p}"/><line x1="2" y1="12" x2="22" y2="12" stroke="${p}"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="${p}"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke="${p}"/><line x1="9" y1="2" x2="12" y2="5" stroke="${p}"/><line x1="15" y1="2" x2="12" y2="5" stroke="${p}"/><line x1="9" y1="22" x2="12" y2="19" stroke="${p}"/><line x1="15" y1="22" x2="12" y2="19" stroke="${p}"/>`,
  ),
  icon('leaf', ['leaf', 'nature', 'plant', 'eco', 'green', 'organic', 'growth', 'environment'], 'Nature', (p) =>
    `<path d="M11 20A7 7 0 0 0 9.8 6.9C15.5 4.9 20 1 20 1s.7 5.4-1.5 9.5" stroke="${p}"/><path d="M5.7 14.8A6.97 6.97 0 0 0 11 20" stroke="${p}"/><path d="M14 14a3 3 0 0 1-5.3 1.9" stroke="${p}"/>`,
  ),
  icon('flower', ['flower', 'blossom', 'bloom', 'petal', 'floral', 'rose', 'daisy', 'garden'], 'Nature', (p, s) =>
    `<circle cx="12" cy="12" r="3" stroke="${s}"/><path d="M12 2a4 4 0 0 1 0 7" stroke="${p}"/><path d="M12 2a4 4 0 0 0 0 7" stroke="${p}"/><path d="M19.07 4.93a4 4 0 0 1-3.54 6.57" stroke="${p}"/><path d="M19.07 4.93a4 4 0 0 0-6.57 3.54" stroke="${p}"/><path d="M22 12a4 4 0 0 1-7 0" stroke="${p}"/><path d="M22 12a4 4 0 0 0-7 0" stroke="${p}"/><path d="M19.07 19.07a4 4 0 0 1-6.57-3.54" stroke="${p}"/><path d="M19.07 19.07a4 4 0 0 0-3.54-6.57" stroke="${p}"/><path d="M12 22a4 4 0 0 1 0-7" stroke="${p}"/><path d="M12 22a4 4 0 0 0 0-7" stroke="${p}"/><path d="M4.93 19.07a4 4 0 0 1 3.54-6.57" stroke="${p}"/><path d="M4.93 19.07a4 4 0 0 0 6.57-3.54" stroke="${p}"/><path d="M2 12a4 4 0 0 1 7 0" stroke="${p}"/><path d="M2 12a4 4 0 0 0 7 0" stroke="${p}"/><path d="M4.93 4.93a4 4 0 0 1 6.57 3.54" stroke="${p}"/><path d="M4.93 4.93a4 4 0 0 0 3.54 6.57" stroke="${p}"/>`,
  ),
  icon('tree', ['tree', 'forest', 'wood', 'pine', 'evergreen', 'christmas'], 'Nature', (p, s) =>
    `<path d="M12 3L4 14h4l-2 4h4l-2 4h8l-2-4h4l-2-4h4L12 3z" stroke="${p}"/><line x1="12" y1="22" x2="12" y2="18" stroke="${s}"/>`,
  ),
  icon('mountain', ['mountain', 'hill', 'peak', 'summit', 'terrain', 'landscape', 'hiking'], 'Nature', (p, s) =>
    `<path d="M8 21l4.5-9 3 4.5L21 8" stroke="${s}"/><path d="M3 21h18L14 6l-3 4.5L8 6 3 21z" stroke="${p}"/>`,
  ),
  icon('wave', ['wave', 'water', 'ocean', 'sea', 'tide', 'surf', 'beach'], 'Nature', (p) =>
    `<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0 4 3 6 0" stroke="${p}"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0 4 3 6 0" stroke="${p}"/>`,
  ),

  // ── Tech ────────────────────────────────────────────────────────────
  icon('code', ['code', 'programming', 'developer', 'brackets', 'html', 'coding', 'software'], 'Tech', (p) =>
    `<polyline points="16 18 22 12 16 6" stroke="${p}"/><polyline points="8 6 2 12 8 18" stroke="${p}"/>`,
  ),
  icon('terminal', ['terminal', 'console', 'command', 'shell', 'cli', 'prompt', 'bash'], 'Tech', (p) =>
    `<polyline points="4 17 10 11 4 5" stroke="${p}"/><line x1="12" y1="19" x2="20" y2="19" stroke="${p}"/>`,
  ),
  icon('database', ['database', 'db', 'storage', 'data', 'sql', 'table', 'records'], 'Tech', (p) =>
    `<ellipse cx="12" cy="5" rx="9" ry="3" stroke="${p}"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="${p}"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="${p}"/>`,
  ),
  icon('server', ['server', 'hosting', 'rack', 'backend', 'infrastructure', 'machine'], 'Tech', (p) =>
    `<rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke="${p}"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke="${p}"/><line x1="6" y1="6" x2="6.01" y2="6" stroke="${p}"/><line x1="6" y1="18" x2="6.01" y2="18" stroke="${p}"/>`,
  ),
  icon('wifi', ['wifi', 'wireless', 'internet', 'network', 'signal', 'connection', 'online'], 'Tech', (p) =>
    `<path d="M5 12.55a11 11 0 0 1 14.08 0" stroke="${p}"/><path d="M1.42 9a16 16 0 0 1 21.16 0" stroke="${p}"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke="${p}"/><line x1="12" y1="20" x2="12.01" y2="20" stroke="${p}"/>`,
  ),
  icon('bluetooth', ['bluetooth', 'wireless', 'pair', 'connect', 'device'], 'Tech', (p) =>
    `<polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" stroke="${p}"/>`,
  ),
  icon('cpu', ['cpu', 'processor', 'chip', 'hardware', 'computing', 'electronics', 'circuit'], 'Tech', (p) =>
    `<rect x="4" y="4" width="16" height="16" rx="2" ry="2" stroke="${p}"/><rect x="9" y="9" width="6" height="6" stroke="${p}"/><line x1="9" y1="1" x2="9" y2="4" stroke="${p}"/><line x1="15" y1="1" x2="15" y2="4" stroke="${p}"/><line x1="9" y1="20" x2="9" y2="23" stroke="${p}"/><line x1="15" y1="20" x2="15" y2="23" stroke="${p}"/><line x1="20" y1="9" x2="23" y2="9" stroke="${p}"/><line x1="20" y1="14" x2="23" y2="14" stroke="${p}"/><line x1="1" y1="9" x2="4" y2="9" stroke="${p}"/><line x1="1" y1="14" x2="4" y2="14" stroke="${p}"/>`,
  ),
  icon('globe', ['globe', 'world', 'earth', 'international', 'web', 'planet', 'global'], 'Tech', (p) =>
    `<circle cx="12" cy="12" r="10" stroke="${p}"/><line x1="2" y1="12" x2="22" y2="12" stroke="${p}"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="${p}"/>`,
  ),

  // ── Objects ─────────────────────────────────────────────────────────
  icon('lightbulb', ['lightbulb', 'idea', 'bright', 'lamp', 'insight', 'creative', 'innovation', 'light'], 'Objects', (p) =>
    `<path d="M9 18h6" stroke="${p}"/><path d="M10 22h4" stroke="${p}"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" stroke="${p}"/>`,
  ),
  icon('key', ['key', 'password', 'access', 'credential', 'token', 'secret', 'unlock'], 'Objects', (p) =>
    `<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="${p}"/>`,
  ),
  icon('lock', ['lock', 'locked', 'secure', 'private', 'encrypted', 'password', 'protect'], 'Objects', (p) =>
    `<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="${p}"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="${p}"/>`,
  ),
  icon('unlock', ['unlock', 'unlocked', 'open', 'access', 'public'], 'Objects', (p) =>
    `<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="${p}"/><path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="${p}"/>`,
  ),
  icon('shield', ['shield', 'security', 'protection', 'safety', 'defense', 'guard', 'trust'], 'Objects', (p) =>
    `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="${p}"/>`,
  ),
  icon('flag', ['flag', 'report', 'country', 'mark', 'milestone', 'banner'], 'Objects', (p) =>
    `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="${p}"/><line x1="4" y1="22" x2="4" y2="15" stroke="${p}"/>`,
  ),
  icon('clock', ['clock', 'time', 'hour', 'watch', 'timer', 'schedule', 'alarm'], 'Objects', (p) =>
    `<circle cx="12" cy="12" r="10" stroke="${p}"/><polyline points="12 6 12 12 16 14" stroke="${p}"/>`,
  ),
  icon('calendar', ['calendar', 'date', 'schedule', 'event', 'appointment', 'planner', 'day'], 'Objects', (p) =>
    `<rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="${p}"/><line x1="16" y1="2" x2="16" y2="6" stroke="${p}"/><line x1="8" y1="2" x2="8" y2="6" stroke="${p}"/><line x1="3" y1="10" x2="21" y2="10" stroke="${p}"/>`,
  ),
  icon('gift', ['gift', 'present', 'surprise', 'box', 'birthday', 'reward', 'prize'], 'Objects', (p, s) =>
    `<polyline points="20 12 20 22 4 22 4 12" stroke="${p}"/><rect x="2" y="7" width="20" height="5" stroke="${p}"/><line x1="12" y1="22" x2="12" y2="7" stroke="${s}"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" stroke="${p}"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" stroke="${p}"/>`,
  ),
  icon('cart', ['cart', 'shopping', 'buy', 'store', 'ecommerce', 'basket', 'purchase'], 'Objects', (p) =>
    `<circle cx="9" cy="21" r="1" stroke="${p}"/><circle cx="20" cy="21" r="1" stroke="${p}"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke="${p}"/>`,
  ),
  icon('rocket', ['rocket', 'launch', 'startup', 'fast', 'speed', 'fly', 'space', 'ship', 'boost'], 'Objects', (p) =>
    `<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="${p}"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="${p}"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="${p}"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="${p}"/>`,
  ),

  // ── Shapes ──────────────────────────────────────────────────────────
  icon('circle', ['circle', 'round', 'dot', 'oval', 'ring', 'orb', 'ball'], 'Shapes', (p) =>
    `<circle cx="12" cy="12" r="10" stroke="${p}"/>`,
  ),
  icon('square', ['square', 'box', 'rectangle', 'block', 'frame'], 'Shapes', (p) =>
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="${p}"/>`,
  ),
  icon('triangle', ['triangle', 'pyramid', 'delta', 'arrow', 'warning', 'alert'], 'Shapes', (p) =>
    `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="${p}"/>`,
  ),
  icon('hexagon', ['hexagon', 'hex', 'honeycomb', 'polygon', 'six'], 'Shapes', (p) =>
    `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="${p}"/>`,
  ),
  icon('diamond', ['diamond', 'gem', 'jewel', 'rhombus', 'precious', 'crystal'], 'Shapes', (p) =>
    `<path d="M12 2L2 12l10 10 10-10L12 2z" stroke="${p}"/>`,
  ),
  icon('pentagon', ['pentagon', 'five', 'polygon', 'shape'], 'Shapes', (p) =>
    `<path d="M12 2l9.51 6.91L18.15 19.8H5.85L2.49 8.91 12 2z" stroke="${p}"/>`,
  ),

  // ── Additional icons to reach ~80 ──────────────────────────────────

  // Extra UI
  icon('eye', ['eye', 'view', 'see', 'watch', 'visible', 'show', 'preview', 'look'], 'UI', (p) =>
    `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="${p}"/><circle cx="12" cy="12" r="3" stroke="${p}"/>`,
  ),
  icon('eye-off', ['eye-off', 'hide', 'hidden', 'invisible', 'blind', 'private'], 'UI', (p) =>
    `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="${p}"/><line x1="1" y1="1" x2="23" y2="23" stroke="${p}"/>`,
  ),
  icon('filter', ['filter', 'funnel', 'sort', 'refine', 'narrow'], 'UI', (p) =>
    `<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke="${p}"/>`,
  ),
  icon('maximize', ['maximize', 'fullscreen', 'expand', 'enlarge', 'resize'], 'UI', (p) =>
    `<polyline points="15 3 21 3 21 9" stroke="${p}"/><polyline points="9 21 3 21 3 15" stroke="${p}"/><line x1="21" y1="3" x2="14" y2="10" stroke="${p}"/><line x1="3" y1="21" x2="10" y2="14" stroke="${p}"/>`,
  ),

  // Extra Communication
  icon('at-sign', ['at-sign', 'email', 'mention', 'at', 'address'], 'Communication', (p) =>
    `<circle cx="12" cy="12" r="4" stroke="${p}"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" stroke="${p}"/>`,
  ),

  // Extra Media
  icon('headphones', ['headphones', 'earphones', 'audio', 'listen', 'music', 'podcast'], 'Media', (p) =>
    `<path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="${p}"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke="${p}"/>`,
  ),

  // Extra Social
  icon('award', ['award', 'trophy', 'medal', 'achievement', 'badge', 'prize', 'winner'], 'Social', (p) =>
    `<circle cx="12" cy="8" r="7" stroke="${p}"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" stroke="${p}"/>`,
  ),

  // Extra Nature
  icon('sunrise', ['sunrise', 'dawn', 'morning', 'horizon', 'daybreak'], 'Nature', (p) =>
    `<path d="M17 18a5 5 0 0 0-10 0" stroke="${p}"/><line x1="12" y1="2" x2="12" y2="9" stroke="${p}"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" stroke="${p}"/><line x1="1" y1="18" x2="3" y2="18" stroke="${p}"/><line x1="21" y1="18" x2="23" y2="18" stroke="${p}"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" stroke="${p}"/><line x1="23" y1="22" x2="1" y2="22" stroke="${p}"/><polyline points="8 6 12 2 16 6" stroke="${p}"/>`,
  ),
  icon('droplet', ['droplet', 'water', 'drop', 'liquid', 'tear', 'rain', 'hydrate'], 'Nature', (p) =>
    `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="${p}"/>`,
  ),
  icon('wind', ['wind', 'air', 'breeze', 'gust', 'blow', 'weather'], 'Nature', (p) =>
    `<path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke="${p}"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke="${p}"/><path d="M15.73 2.27A2.5 2.5 0 1 1 17.5 7H2" stroke="${p}"/>`,
  ),

  // Extra Tech
  icon('monitor', ['monitor', 'screen', 'display', 'desktop', 'computer', 'tv'], 'Tech', (p) =>
    `<rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="${p}"/><line x1="8" y1="21" x2="16" y2="21" stroke="${p}"/><line x1="12" y1="17" x2="12" y2="21" stroke="${p}"/>`,
  ),
  icon('smartphone', ['smartphone', 'phone', 'mobile', 'device', 'cell', 'iphone', 'android'], 'Tech', (p) =>
    `<rect x="5" y="2" width="14" height="20" rx="2" ry="2" stroke="${p}"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="${p}"/>`,
  ),
  icon('battery', ['battery', 'power', 'charge', 'energy', 'level'], 'Tech', (p) =>
    `<rect x="1" y="6" width="18" height="12" rx="2" ry="2" stroke="${p}"/><line x1="23" y1="13" x2="23" y2="11" stroke="${p}"/>`,
  ),
  icon('zap', ['zap', 'lightning', 'bolt', 'electricity', 'power', 'energy', 'flash', 'thunder'], 'Tech', (p) =>
    `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="${p}"/>`,
  ),

  // Extra Objects
  icon('briefcase', ['briefcase', 'work', 'job', 'business', 'career', 'portfolio', 'office'], 'Objects', (p) =>
    `<rect x="2" y="7" width="20" height="14" rx="2" ry="2" stroke="${p}"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke="${p}"/>`,
  ),
  icon('compass', ['compass', 'navigate', 'direction', 'explore', 'travel', 'adventure', 'north'], 'Objects', (p, s) =>
    `<circle cx="12" cy="12" r="10" stroke="${p}"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" stroke="${s}"/>`,
  ),
  icon('map', ['map', 'location', 'geography', 'directions', 'navigation', 'route'], 'Objects', (p) =>
    `<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" stroke="${p}"/><line x1="8" y1="2" x2="8" y2="18" stroke="${p}"/><line x1="16" y1="6" x2="16" y2="22" stroke="${p}"/>`,
  ),
  icon('pin', ['pin', 'location', 'place', 'map-pin', 'marker', 'gps', 'position'], 'Objects', (p) =>
    `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="${p}"/><circle cx="12" cy="10" r="3" stroke="${p}"/>`,
  ),
  icon('scissors', ['scissors', 'cut', 'trim', 'clip', 'snip', 'crop'], 'Objects', (p) =>
    `<circle cx="6" cy="6" r="3" stroke="${p}"/><circle cx="6" cy="18" r="3" stroke="${p}"/><line x1="20" y1="4" x2="8.12" y2="15.88" stroke="${p}"/><line x1="14.47" y1="14.48" x2="20" y2="20" stroke="${p}"/><line x1="8.12" y1="8.12" x2="12" y2="12" stroke="${p}"/>`,
  ),
  icon('anchor', ['anchor', 'maritime', 'port', 'dock', 'naval', 'ship', 'boat'], 'Objects', (p) =>
    `<circle cx="12" cy="5" r="3" stroke="${p}"/><line x1="12" y1="22" x2="12" y2="8" stroke="${p}"/><path d="M5 12H2a10 10 0 0 0 20 0h-3" stroke="${p}"/>`,
  ),
  icon('coffee', ['coffee', 'cup', 'drink', 'beverage', 'tea', 'cafe', 'mug', 'hot'], 'Objects', (p) =>
    `<path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke="${p}"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke="${p}"/><line x1="6" y1="1" x2="6" y2="4" stroke="${p}"/><line x1="10" y1="1" x2="10" y2="4" stroke="${p}"/><line x1="14" y1="1" x2="14" y2="4" stroke="${p}"/>`,
  ),
  icon('tool', ['tool', 'wrench', 'repair', 'fix', 'maintenance', 'utility', 'spanner'], 'Objects', (p) =>
    `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="${p}"/>`,
  ),

  // Extra Shapes
  icon('octagon', ['octagon', 'stop-sign', 'eight', 'shape', 'polygon'], 'Shapes', (p) =>
    `<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" stroke="${p}"/>`,
  ),
  icon('crosshair', ['crosshair', 'target', 'aim', 'focus', 'scope', 'center', 'precision'], 'Shapes', (p) =>
    `<circle cx="12" cy="12" r="10" stroke="${p}"/><line x1="22" y1="12" x2="18" y2="12" stroke="${p}"/><line x1="6" y1="12" x2="2" y2="12" stroke="${p}"/><line x1="12" y1="6" x2="12" y2="2" stroke="${p}"/><line x1="12" y1="22" x2="12" y2="18" stroke="${p}"/>`,
  ),
];
