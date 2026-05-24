CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger AS $$
BEGIN
	NEW."updated_at" = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "feeds_set_updated_at" ON "feeds";--> statement-breakpoint
CREATE TRIGGER "feeds_set_updated_at"
BEFORE UPDATE ON "feeds"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
