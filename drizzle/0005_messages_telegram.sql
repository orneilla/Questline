CREATE TABLE "messages_envoyes" (
	"date" date NOT NULL,
	"type" text NOT NULL,
	"envoye_le" text NOT NULL,
	"message_id" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX "messages_envoyes_date_type_uniq" ON "messages_envoyes" USING btree ("date","type");