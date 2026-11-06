CREATE TABLE admin_users(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,created TEXT NOT NULL);
CREATE TABLE library_tracks(id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,size_bytes BIGINT NOT NULL,duration REAL NOT NULL,created TEXT NOT NULL);
CREATE TABLE admin_audit(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL,created TEXT NOT NULL);
CREATE INDEX admin_audit_created ON admin_audit(created);
