import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// 应用:配置的顶层容器,slug 出现在公开拉取 URL 里
export const configApps = pgTable(
  'config_apps',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    description: varchar('description', { length: 200 }).notNull().default(''),
    // 停用后公开拉取一律 404,后台照常可编辑
    enabled: boolean('enabled').notNull().default(true),
    // 带上它才能读到 private 参数;public 参数无需任何凭证
    serverKey: varchar('server_key', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('config_apps_slug_uq').on(table.slug),
    uniqueIndex('config_apps_server_key_uq').on(table.serverKey),
  ],
);

// 环境:建应用时自动插 dev / prod,之后可增删
export const configEnvironments = pgTable(
  'config_environments',
  {
    id: serial('id').primaryKey(),
    appId: integer('app_id')
      .notNull()
      .references(() => configApps.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('config_environments_app_name_uq').on(table.appId, table.name),
  ],
);

// 参数:key 形如 Group:Key;value 存原文,按 type 转真值下发
export const configParameters = pgTable(
  'config_params',
  {
    id: serial('id').primaryKey(),
    environmentId: integer('environment_id')
      .notNull()
      .references(() => configEnvironments.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 128 }).notNull(),
    type: varchar('type', { length: 16 }).notNull(),
    scope: varchar('scope', { length: 16 }).notNull().default('public'),
    value: text('value').notNull(),
    description: varchar('description', { length: 200 }).notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('config_params_env_key_uq').on(table.environmentId, table.key),
  ],
);
