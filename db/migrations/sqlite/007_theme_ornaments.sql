CREATE TABLE theme_ornaments(id TEXT PRIMARY KEY,theme_id TEXT NOT NULL,asset_id TEXT NOT NULL UNIQUE REFERENCES theme_assets(id) ON DELETE CASCADE,config TEXT NOT NULL,created TEXT NOT NULL);
CREATE INDEX theme_ornaments_theme ON theme_ornaments(theme_id,created);
