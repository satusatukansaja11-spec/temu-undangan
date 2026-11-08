ALTER TABLE theme_orders ADD COLUMN package_id TEXT NOT NULL DEFAULT 'pro' CHECK(package_id IN ('pro','premium'));
ALTER TABLE event_licenses ADD COLUMN legacy_story INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_licenses ADD COLUMN legacy_gallery INTEGER NOT NULL DEFAULT 0;
UPDATE event_licenses SET legacy_story=1 WHERE event_id IN (SELECT id FROM events WHERE CASE WHEN jsonb_typeof(data::jsonb->'stories')='array' THEN jsonb_array_length(data::jsonb->'stories') ELSE 0 END>0);
UPDATE event_licenses SET legacy_gallery=COALESCE((SELECT CASE WHEN jsonb_typeof(data::jsonb->'gallery')='array' THEN jsonb_array_length(data::jsonb->'gallery') ELSE 0 END FROM events WHERE events.id=event_licenses.event_id),0);
