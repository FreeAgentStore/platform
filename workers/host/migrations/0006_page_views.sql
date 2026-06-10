CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  is_human INTEGER NOT NULL DEFAULT 1,
  country TEXT,
  browser TEXT,
  device TEXT,
  referer TEXT,
  ip_hash TEXT,
  bot_reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_pv_human ON page_views(is_human, created_at);
CREATE INDEX IF NOT EXISTS idx_pv_path ON page_views(path, created_at);
