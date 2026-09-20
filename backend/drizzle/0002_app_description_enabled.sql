ALTER TABLE "config_apps" ADD COLUMN "description" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "config_apps" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "config_params" ADD COLUMN "description" varchar(200) DEFAULT '' NOT NULL;