'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, PackageSearch, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AppAvatar } from '@/components/app-avatar';
import type { ConfigApp } from '@/lib/models';
import { combineClassNames } from '@/lib/utils';

const RECENT_KEY = 'rc.recentAppIds';
const RECENT_LIMIT = 3;

function readRecentIds(): number[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'number') : [];
  } catch {
    return [];
  }
}

function pushRecentId(appId: number): number[] {
  const next = [appId, ...readRecentIds().filter((recentId) => recentId !== appId)].slice(
    0,
    RECENT_LIMIT,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // 隐私模式写不进去无所谓,最近使用只是个便利
  }
  return next;
}

// 顶栏的应用切换器:可搜索,最近使用置顶,行里带图标和 slug
export function AppSwitcher({
  apps,
  activeApp,
  isLoading,
  onSelect,
}: {
  apps: ConfigApp[];
  activeApp: ConfigApp | null;
  isLoading: boolean;
  onSelect: (appId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [recentIds, setRecentIds] = useState<number[]>(() =>
    typeof window === 'undefined' ? [] : readRecentIds(),
  );

  const normalized = keyword.trim().toLowerCase();
  const matches = useMemo(
    () =>
      normalized
        ? apps.filter(
            (app) =>
              app.name.toLowerCase().includes(normalized) ||
              app.slug.includes(normalized),
          )
        : apps,
    [apps, normalized],
  );
  // 搜索时不分「最近使用」,直接给结果
  const recentApps = normalized
    ? []
    : recentIds
        .map((recentId) => apps.find((app) => app.id === recentId))
        .filter((app): app is ConfigApp => app !== undefined);

  function choose(app: ConfigApp) {
    setRecentIds(pushRecentId(app.id));
    onSelect(app.id);
    setOpen(false);
    setKeyword('');
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setKeyword('');
      }}
    >
      <PopoverTrigger
        aria-label="当前应用"
        className="flex h-9 min-w-40 items-center gap-2 rounded-md border bg-card px-2 text-sm transition-colors hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {activeApp ? (
          <>
            <AppAvatar name={activeApp.name} slug={activeApp.slug} enabled={activeApp.enabled} size="sm" />
            <span className="min-w-0 flex-1 truncate text-left font-medium">
              {activeApp.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-muted-foreground">
            {isLoading ? '加载中…' : apps.length ? '选择应用' : '暂无应用'}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={keyword}
            placeholder="搜索应用名称或 slug…"
            aria-label="搜索应用"
            className="h-9 pl-8"
            onChange={(changeEvent) => setKeyword(changeEvent.target.value)}
          />
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {isLoading ? (
            <SwitcherSkeleton />
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <PackageSearch className="size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">没有找到匹配的应用</p>
              <p className="text-xs text-muted-foreground">试试其它关键词</p>
            </div>
          ) : (
            <>
              {recentApps.length > 0 && (
                <AppGroup
                  title="最近使用"
                  apps={recentApps}
                  activeId={activeApp?.id}
                  onChoose={choose}
                />
              )}
              <AppGroup
                title={normalized ? `匹配 (${matches.length})` : `全部应用 (${apps.length})`}
                apps={matches}
                activeId={activeApp?.id}
                onChoose={choose}
              />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AppGroup({
  title,
  apps,
  activeId,
  onChoose,
}: {
  title: string;
  apps: ConfigApp[];
  activeId: number | undefined;
  onChoose: (app: ConfigApp) => void;
}) {
  return (
    <div>
      <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">{title}</p>
      <ul className="space-y-0.5">
        {apps.map((app) => {
          const isActive = app.id === activeId;
          return (
            <li key={app.id}>
              <button
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => onChoose(app)}
                className={combineClassNames(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none',
                  isActive && 'bg-accent/50',
                )}
              >
                <AppAvatar name={app.name} slug={app.slug} enabled={app.enabled} size="md" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {app.name}
                  {!app.enabled && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      已停用
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {app.slug}
                </span>
                {isActive && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SwitcherSkeleton() {
  return (
    <ul className="space-y-1 px-1 py-1">
      {Array.from(Array(4).keys()).map((row) => (
        <li key={row} className="flex items-center gap-2.5 py-1.5">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ul>
  );
}
