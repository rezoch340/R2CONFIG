CREATE TABLE "config_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"server_key" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_environments" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"name" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_params" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment_id" integer NOT NULL,
	"key" varchar(128) NOT NULL,
	"type" varchar(16) NOT NULL,
	"scope" varchar(16) DEFAULT 'public' NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "config_environments" ADD CONSTRAINT "config_environments_app_id_config_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."config_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config_params" ADD CONSTRAINT "config_params_environment_id_config_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."config_environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "config_apps_slug_uq" ON "config_apps" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "config_apps_server_key_uq" ON "config_apps" USING btree ("server_key");--> statement-breakpoint
CREATE UNIQUE INDEX "config_environments_app_name_uq" ON "config_environments" USING btree ("app_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "config_params_env_key_uq" ON "config_params" USING btree ("environment_id","key");