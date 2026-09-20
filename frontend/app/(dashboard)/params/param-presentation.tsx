'use client';

import { useState } from 'react';
import {
  AppWindow,
  Boxes,
  ChevronRight,
  CreditCard,
  Sprout,
  Zap,
} from 'lucide-react';
import {
  inferPresentation,
  isHttpUrl,
  JSON_TYPE_SYMBOLS,
  type JsonType,
  type JsonValue,
} from '@/components/json-builder/json-builder-utils';
import { combineClassNames } from '@/lib/utils';

export { ENVIRONMENT_DOT_CLASS, environmentTone } from '@/lib/environment-tone';

// 只负责「长什么样」的一堆小件:名字美化、分组色、环境色、值预览卡

// BiometricLogin → Biometric Login;snake_case / kebab-case 也拆开
export function humanizeKeyName(name: string): string {
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (first) => first.toUpperCase());
}

// 分组图标:帮助认域,不是装饰;认识的几个给专用图标,其余一律 Boxes,统一中性色
const GROUP_ICONS: Record<string, typeof Boxes> = {
  app: AppWindow,
  features: Zap,
  feature: Zap,
  onboarding: Sprout,
  payment: CreditCard,
  billing: CreditCard,
};

// 底色按名字哈希从几个淡色里挑,同名永远同色;规范 §3.1 不建议,但整页太灰了
const GROUP_TILE_CLASSES = [
  'border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300',
];

function groupTileClass(group: string): string {
  let hash = 0;
  for (const character of group) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return GROUP_TILE_CLASSES[Math.abs(hash) % GROUP_TILE_CLASSES.length];
}

export function GroupIcon({ group }: { group: string }) {
  const Icon = GROUP_ICONS[group.toLowerCase()] ?? Boxes;
  return (
    <span
      className={combineClassNames(
        'flex size-8 shrink-0 items-center justify-center rounded-md border',
        groupTileClass(group),
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

// 类型小方块:{ } [ ] Aa,等宽字,淡淡的主色(规范里 JSON 类型允许 subtle primary)
export function TypeTile({ type }: { type: JsonType }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 font-mono text-sm text-primary">
      {JSON_TYPE_SYMBOLS[type]}
    </span>
  );
}

const PREVIEW_LIMIT = 4;

function shortValue(value: JsonValue): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} 项]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).length} 字段}`;
  }
  return String(value);
}

function pickTitle(item: JsonValue): string | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
  for (const candidate of ['name', 'title', 'label', 'id']) {
    const field = item[candidate];
    if (typeof field === 'string' && field.length > 0) return field;
  }
  return null;
}

function pickImage(item: JsonValue): string | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
  for (const [key, field] of Object.entries(item)) {
    if (typeof field === 'string' && inferPresentation(key, field) === 'image-url') {
      return field;
    }
  }
  return null;
}

function pickLink(item: JsonValue): string | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
  for (const field of Object.values(item)) {
    if (typeof field === 'string' && isHttpUrl(field)) return field;
  }
  return null;
}

// json 参数在列表里的预览:对象给前几对 key/value,数组给逐项摘要,点整卡进编辑
export function JsonPreviewCard({
  source,
  scopeBadge,
  onOpen,
  disabled,
}: {
  source: string;
  scopeBadge: React.ReactNode;
  onOpen: () => void;
  disabled: boolean;
}) {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(source) as JsonValue;
  } catch {
    parsed = source;
  }
  const isArray = Array.isArray(parsed);
  const isObject = !isArray && parsed !== null && typeof parsed === 'object';
  const entries = isObject
    ? Object.entries(parsed as Record<string, JsonValue>)
    : [];
  const items = isArray ? (parsed as JsonValue[]) : [];
  const summary = isArray
    ? `Array · ${items.length} 项`
    : isObject
      ? `JSON · ${entries.length} 字段`
      : 'JSON';

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="打开 JSON 编辑器"
      onClick={onOpen}
      className="group flex w-full items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <TypeTile type={isArray ? 'array' : 'object'} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{summary}</span>
          {scopeBadge}
        </div>
        {isObject && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
            {entries.slice(0, PREVIEW_LIMIT).map(([key, value]) => (
              <PreviewRow key={key} label={key} value={value} />
            ))}
            {entries.length > PREVIEW_LIMIT && (
              <dt className="text-muted-foreground">…</dt>
            )}
          </dl>
        )}
        {isArray && (
          <ul className="space-y-1">
            {items.slice(0, PREVIEW_LIMIT).map((item, index) => (
              <ArrayItemPreview key={index} index={index} item={item} />
            ))}
            {items.length > PREVIEW_LIMIT && (
              <li className="font-mono text-xs text-muted-foreground">…</li>
            )}
          </ul>
        )}
        {!isObject && !isArray && (
          <code className="block truncate font-mono text-xs text-muted-foreground">
            {source}
          </code>
        )}
      </div>
      <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  );
}

function PreviewRow({ label, value }: { label: string; value: JsonValue }) {
  const isBoolean = typeof value === 'boolean';
  const isNumber = typeof value === 'number';
  return (
    <>
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd
        className={combineClassNames(
          'truncate',
          isBoolean && 'text-primary',
          isNumber && 'text-warning',
        )}
      >
        {shortValue(value)}
      </dd>
    </>
  );
}

function ArrayItemPreview({ index, item }: { index: number; item: JsonValue }) {
  const title = pickTitle(item);
  const image = pickImage(item);
  const link = pickLink(item);
  if (title === null) {
    return (
      <li className="flex items-center gap-2 font-mono text-xs">
        <span className="w-4 text-muted-foreground">{index + 1}</span>
        <span className="truncate">{shortValue(item)}</span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2">
      <BusinessIcon url={image} title={title} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        {link && (
          <span className="block truncate font-mono text-xs text-muted-foreground">
            {link}
          </span>
        )}
      </span>
    </li>
  );
}

// 业务图标:远程图片 → 首字母头像(中性底),不用通用图标顶替
function BusinessIcon({ url, title }: { url: string | null; title: string }) {
  const [isBroken, setIsBroken] = useState(false);
  if (url && !isBroken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 用户填的任意外链
      <img
        src={url}
        alt=""
        className="size-7 shrink-0 rounded-md border border-border object-cover"
        onError={() => setIsBroken(true)}
      />
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-xs font-medium text-muted-foreground">
      {title.slice(0, 1).toUpperCase()}
    </span>
  );
}
