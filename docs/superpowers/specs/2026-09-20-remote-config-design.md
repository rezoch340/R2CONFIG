# Remote Config 设计

日期：2026-09-20
底座：admin-base（NestJS 11 + Drizzle + PostgreSQL + Redis / Next.js 16 + React 19 + Tailwind 4）

## 目标

给自己的 app（自己的各个 app）做动态配置下发：后台改一个值，app 下次拉取就是新的。参考 Nona Config 的交互与视觉，不 fork。

## 非目标

灰度 / 百分比发布、按用户或按 app 版本定向、发布版本快照与回滚、分享链接、i18n、Redis 缓存、SDK。操作历史靠底座已有的系统日志。

## 数据模型

三张表，加一个 Drizzle 迁移 `0001_remote_config.sql`，沿用 `users.schema.ts` 的写法（serial id、withTimezone 时间戳、软删不需要）。

```
config_projects
  id            serial pk
  name          varchar(64)  not null            # 显示名
  slug          varchar(64)  not null unique     # 小写字母数字连字符，作为 URL/日志标识
  api_key       varchar(64)  not null unique     # 32 字节随机 hex，只读拉取凭证
  created_at    timestamptz  not null default now()

config_environments
  id            serial pk
  project_id    int not null -> config_projects.id on delete cascade
  name          varchar(32)  not null            # 建项目时自动插 dev、prod；之后可增删
  created_at    timestamptz  not null default now()
  unique (project_id, name)

config_params
  id            serial pk
  environment_id int not null -> config_environments.id on delete cascade
  key           varchar(128) not null            # 形如 Group:Key；冒号前为分组，前端据此折叠
  type          varchar(16)  not null            # text | boolean | json
  value         text         not null            # 原文；boolean 存 "true"/"false"，json 存序列化串
  updated_at    timestamptz  not null default now()
  unique (environment_id, key)
```

`key` 校验：`^[A-Za-z0-9_.-]+(:[A-Za-z0-9_.-]+)*$`，最多 128 字符。`type=json` 时写入前 `JSON.parse` 校验。

## 后端

新模块 `backend/src/application/config/`，文件：`config.schema.ts`、`config.module.ts`、`config.controller.ts`（后台）、`config-public.controller.ts`（公开拉取）、`config.service.ts`、`dto/`。

### 后台接口（JWT + `@RequirePermission(action, 'config')`，路径省略底座全局前缀）

| 方法 | 路径 | 权限 |
|---|---|---|
| GET | `/api/config/projects` | read |
| POST | `/api/config/projects` `{name, slug}` → 自动建 dev、prod | create |
| PATCH | `/api/config/projects/:id` `{name}` | update |
| DELETE | `/api/config/projects/:id` | delete |
| POST | `/api/config/projects/:id/rotate-key` → 新 api_key | update |
| GET | `/api/config/projects/:id/environments` | read |
| POST | `/api/config/projects/:id/environments` `{name}` | create |
| DELETE | `/api/config/environments/:id` | delete |
| GET | `/api/config/environments/:id/params?search=` | read |
| POST | `/api/config/environments/:id/params` `{key, type, value}` | create |
| PATCH | `/api/config/params/:id` `{type?, value?}` | update |
| DELETE | `/api/config/params/:id` | delete |
| POST | `/api/config/environments/:id/params/import` `{ "Group:Key": value, ... }` → upsert，值类型按 JS 类型推断（boolean → boolean，object/array → json，其余 text） | create |

api_key 只在列表/详情返回给有 `read config` 权限的账号，前端带复制按钮。

权限目录：`seed-admin.ts` 追加 `read/create/update/delete` × `config`，描述"查看/创建/修改/删除远程配置"。审计：`system-audit-definition.ts` 追加 `config: { label: '远程配置', subject: 'config', targetType: 'config' }`，写操作自动进系统日志。

### 公开拉取接口（`@Public`）

```
GET /api/v1/config/:envName          # 同样在全局前缀下；v1 与后台路径区分开
Header: X-Api-Key: <project api_key>
```

- 按 api_key 找项目，再按 `envName` 找环境；任一不存在 → 404，无 key 或 key 错 → 401
- 响应：`{ "App:Announcement": {...}, "Features:BiometricLogin": true, "Onboarding:Variant": "carousel" }`，按 type 转成真值
- `ETag`：环境下 `count(*)` 与 `max(updated_at)` 拼串取 sha1，弱 ETag。请求带 `If-None-Match` 命中 → 304 空体
- `Cache-Control: no-cache`（让客户端每次带 ETag 回来验证）
- 不限流、不缓存；PG 单查一次够用

## 前端

### 顶栏切换器

`app-shell.tsx` 顶栏加"当前项目 ▾ / 当前环境 ▾"两个下拉。选中值存 localStorage `rc.activeProjectId` / `rc.activeEnvId`；首次进入默认第一个项目的 `prod`。项目列表来自 `/api/config/projects`，环境列表随项目变化。

### 页面

- `/params`（`/` 重定向到这里）：显示当前 project+env 的参数。列表按 `Group` 折叠分组（冒号前缀，无冒号归 "默认"）；值列 boolean 渲染开关、text 渲染单行输入、json 渲染等宽多行；行内改值出现 Update 按钮，点了才提交；详情列显示类型；操作列 Edit（弹窗改类型和值）/ Delete；顶部搜索（key 包含匹配，后端 `search` 参数）、Bulk Import（弹窗贴 JSON）、Add Parameter。
- `/projects`：项目卡片/表格，新建项目弹窗，行内展示 api_key + 复制 + 重置，展开管理环境（增删）。

导航：`app-shell` 的"工作台"分组下加"参数"和"项目"两项，权限 `{ action: 'read', subject: 'config' }`。

### 视觉

把 Nona `admin/DESIGN.md` 的 token 写进 `globals.css`：底色 obsidian 系（#09090b / #121214 / #18181b / #27272a），主色 indigo #6366f1，强调 emerald #10b981，错误 coral #f87171；字体 Space Grotesk（标题）/ Inter（正文）/ JetBrains Mono（key、json）。只改 CSS 变量和字体引入，不改组件结构；保持底座现有的浅色主题可切换。

## 测试

- 后端：`config.service.spec.ts` 覆盖 key 校验、json 校验、import 类型推断、ETag 计算；跟底座现有 spec 风格一致。
- `tests/api-smoke.mjs` 追加一段：建项目 → 加参数 → 用 api_key 拉 `/api/v1/config/prod` → 校验真值与 304。
- 前端不加 e2e。

## 部署

跟 Flagsmith 同一套路：`/opt/1panel/docker/compose/remote-config/` 单文件 compose + `.env`，backend/frontend 两个容器绑 `127.0.0.1`，复用 `1Panel-postgresql-WdTm`（PG 18，底座要求 16+，兼容）和 `1Panel-redis-5qXb`。反代 `flags.example.com` 从 Flagsmith 切过来，Flagsmith 下线。部署细节不在本 spec，另起。
