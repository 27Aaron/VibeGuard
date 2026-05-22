ALTER TABLE "security_advisories" ADD COLUMN "source_url" text;
ALTER TABLE "security_advisories" ADD COLUMN "raw_hash" varchar(128);

UPDATE "security_advisories" AS "advisory"
SET
  "source_url" = "source"."source_url",
  "raw_hash" = "source"."raw_hash"
FROM "security_source_records" AS "source"
WHERE "advisory"."source_record_id" = "source"."id";

ALTER TABLE "security_advisories"
  ALTER COLUMN "source_url" SET NOT NULL;

ALTER TABLE "security_advisories"
  DROP CONSTRAINT IF EXISTS "security_advisories_source_record_id_security_source_records_id_fk";

ALTER TABLE "security_advisories"
  DROP COLUMN "source_record_id";

DROP TABLE IF EXISTS "security_source_records";
DROP TYPE IF EXISTS "security_parse_status";
