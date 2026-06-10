ALTER TABLE routes ADD COLUMN owner_id TEXT;
CREATE INDEX IF NOT EXISTS idx_routes_owner ON routes(owner_id);
