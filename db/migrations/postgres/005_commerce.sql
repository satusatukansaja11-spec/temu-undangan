CREATE TABLE shop_settings(id INTEGER PRIMARY KEY, data TEXT NOT NULL);
INSERT INTO shop_settings VALUES(1,'{"enabled":false,"bank":"","account":"","holder":"","whatsapp":"6282137665266","instructions":"","hours":24,"prices":{"navy":0,"sakura":0}}');
CREATE TABLE theme_orders(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,theme_id TEXT NOT NULL,amount BIGINT NOT NULL,bank_snapshot TEXT NOT NULL,status TEXT NOT NULL,confirmation TEXT NOT NULL,reason TEXT NOT NULL,transfer_ref TEXT UNIQUE,event_id TEXT REFERENCES events(id) ON DELETE SET NULL,created TEXT NOT NULL,deadline TEXT NOT NULL,verified_by TEXT,verified_at TEXT,proof_id TEXT);
CREATE INDEX theme_orders_owner ON theme_orders(owner,created);
CREATE INDEX theme_orders_status ON theme_orders(status,created);
CREATE TABLE event_licenses(event_id TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,order_id TEXT UNIQUE REFERENCES theme_orders(id),theme_id TEXT NOT NULL,legacy INTEGER NOT NULL DEFAULT 0,locked_date TEXT,locked_timezone TEXT,expires_at TEXT,created TEXT NOT NULL);
INSERT INTO event_licenses(event_id,theme_id,legacy,created) SELECT id,'navy',1,created FROM events;
