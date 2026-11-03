CREATE TABLE recipients(id TEXT PRIMARY KEY,event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,name TEXT NOT NULL,created TEXT NOT NULL);
CREATE INDEX recipients_event ON recipients(event_id,created);
CREATE TABLE share_settings(event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,message TEXT NOT NULL);
