CREATE TABLE "fiscal_locks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"year" integer NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now()
);
