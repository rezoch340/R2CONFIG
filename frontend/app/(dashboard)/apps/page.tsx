'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CopyButton } from '@/components/copy-button';
import { FieldError } from '@/components/field-error';
import { FormDialog } from '@/components/form-dialog';
import { PageHeader } from '@/components/page-header';
import { PermissionBoundary } from '@/components/permission-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getRequestErrorMessage, requestApi } from '@/lib/api-client';
import { useAuthentication } from '@/lib/auth';
import { useActiveConfig } from '@/lib/config-context';
import { formatDateTime } from '@/lib/format';
import type { ConfigApp, ConfigEnvironment } from '@/lib/models';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_HINT = '只能是小写字母、数字和连字符,例如 my-app';

type Confirmation =
  | { type: 'delete-app'; app: ConfigApp }
  | { type: 'rotate-key'; app: ConfigApp }
  | { type: 'delete-env'; app: ConfigApp; environment: ConfigEnvironment };

export default function AppsPage() {
  const queryClient = useQueryClient();
  const { can } = useAuthentication();
  const { apps, isLoading } = useActiveConfig();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renamingApp, setRenamingApp] = useState<ConfigApp | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');

  const invalidateApps = () =>
    queryClient.invalidateQueries({ queryKey: ['config-apps'] });

  const visibleApps = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return apps;
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(keyword) ||
        app.slug.includes(keyword),
    );
  }, [apps, search]);

  const createMutation = useMutation({
    mutationFn: (body: { name: string; slug: string }) =>
      requestApi<ConfigApp>('/config/apps', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async (app) => {
      toast.success(`应用 ${app.name} 已创建,自带 dev / prod 环境`);
      setIsCreateOpen(false);
      await invalidateApps();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '创建应用失败')),
  });

  const renameMutation = useMutation({
    mutationFn: (input: { id: number; name: string }) =>
      requestApi<ConfigApp>(`/config/apps/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: input.name }),
      }),
    onSuccess: async () => {
      toast.success('应用已重命名');
      setRenamingApp(null);
      await invalidateApps();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '重命名失败')),
  });

  const confirmMutation = useMutation({
    mutationFn: async (action: Confirmation) => {
      if (action.type === 'delete-app') {
        await requestApi(`/config/apps/${action.app.id}`, { method: 'DELETE' });
      } else if (action.type === 'rotate-key') {
        await requestApi(`/config/apps/${action.app.id}/rotate-key`, {
          method: 'POST',
        });
      } else {
        await requestApi(`/config/environments/${action.environment.id}`, {
          method: 'DELETE',
        });
      }
      return action;
    },
    onSuccess: async (action) => {
      toast.success(
        action.type === 'delete-app'
          ? '应用已删除'
          : action.type === 'rotate-key'
            ? 'server key 已重置,旧 key 立即失效'
            : '环境已删除',
      );
      setConfirmation(null);
      await invalidateApps();
    },
    onError: (error) => toast.error(getRequestErrorMessage(error, '操作失败')),
  });

  return (
    <PermissionBoundary action="read" subject="config">
      <PageHeader
        eyebrow="Apps"
        title="应用"
        description="每个应用是一组配置的顶层容器,自带 dev / prod 环境;app 端用 slug 拉取配置。"
        actions={
          can('create', 'config') ? (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus />
              新建应用
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from(Array(4).keys()).map((cardIndex) => (
            <AppCardSkeleton key={cardIndex} />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          还没有应用,点右上角新建一个。
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder="搜索应用名或 slug…"
                className="pl-8"
                onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {visibleApps.length} / {apps.length}
            </span>
          </div>
          {visibleApps.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              没有匹配的应用
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleApps.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onRename={() => setRenamingApp(app)}
                  onConfirm={setConfirmation}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AppCreateDialog
        key={`create-${isCreateOpen}`}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isSubmitting={createMutation.isPending}
        onCreate={async (values) => {
          await createMutation.mutateAsync(values);
        }}
      />
      <AppRenameDialog
        key={`rename-${renamingApp?.id ?? 'closed'}`}
        app={renamingApp}
        isSubmitting={renameMutation.isPending}
        onClose={() => setRenamingApp(null)}
        onSave={async (appId, name) => {
          await renameMutation.mutateAsync({ id: appId, name });
        }}
      />
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={
          confirmation?.type === 'delete-app'
            ? '删除应用'
            : confirmation?.type === 'rotate-key'
              ? '重置 server key'
              : '删除环境'
        }
        description={
          confirmation?.type === 'delete-app'
            ? `确定删除 ${confirmation.app.name}?它下面所有环境和参数一起删除,不可恢复。`
            : confirmation?.type === 'rotate-key'
              ? `重置后旧 key 立即失效,正在用它读取 private 参数的后端会拿到 401。`
              : `确定删除 ${confirmation?.app.name} / ${confirmation?.environment.name}?这个环境的参数一起删除。`
        }
        confirmLabel={confirmation?.type === 'rotate-key' ? '重置' : '删除'}
        destructive
        isPending={confirmMutation.isPending}
        onConfirm={() => confirmation && confirmMutation.mutate(confirmation)}
      />
    </PermissionBoundary>
  );
}

function AppCard({
  app,
  onRename,
  onConfirm,
}: {
  app: ConfigApp;
  onRename: () => void;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const queryClient = useQueryClient();
  const { can } = useAuthentication();
  const [newEnvironment, setNewEnvironment] = useState('');
  const [environmentError, setEnvironmentError] = useState<string | null>(
    null,
  );

  const addEnvironment = useMutation({
    mutationFn: (name: string) =>
      requestApi<ConfigEnvironment>(`/config/apps/${app.id}/environments`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (environment) => {
      toast.success(`环境 ${environment.name} 已添加`);
      setNewEnvironment('');
      await queryClient.invalidateQueries({ queryKey: ['config-apps'] });
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '添加环境失败')),
  });

  function submitEnvironment(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const name = newEnvironment.trim();
    if (!SLUG_PATTERN.test(name)) {
      setEnvironmentError(`环境名${SLUG_HINT}`);
      return;
    }
    setEnvironmentError(null);
    addEnvironment.mutate(name);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{app.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {app.slug} · 创建于 {formatDateTime(app.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="重命名"
            disabled={!can('update', 'config')}
            onClick={onRename}
          >
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="删除应用"
            disabled={!can('delete', 'config')}
            onClick={() => onConfirm({ type: 'delete-app', app })}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          拉取地址
        </p>
        <code className="block truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs">
          GET /v1/config/{app.slug}/{'{env}'}
        </code>
      </div>

      <div className="space-y-1.5">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Server key · 带上才能读 private 参数
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs">
            {app.serverKey}
          </code>
          <CopyButton value={app.serverKey} label="复制 server key" />
          <Button
            size="icon"
            variant="ghost"
            aria-label="重置 server key"
            disabled={!can('update', 'config')}
            onClick={() => onConfirm({ type: 'rotate-key', app })}
          >
            <RefreshCw />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          环境
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {app.environments.map((environment) => (
            <Badge
              key={environment.id}
              variant="secondary"
              className="gap-1 pr-1 font-mono"
            >
              {environment.name}
              <button
                type="button"
                aria-label={`删除环境 ${environment.name}`}
                disabled={!can('delete', 'config')}
                className="rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-40"
                onClick={() =>
                  onConfirm({ type: 'delete-env', app, environment })
                }
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          {can('create', 'config') ? (
            <form className="flex items-center gap-1" onSubmit={submitEnvironment}>
              <Input
                value={newEnvironment}
                placeholder="staging"
                maxLength={32}
                className="h-7 w-28 font-mono text-xs"
                aria-invalid={!!environmentError}
                onChange={(changeEvent) => {
                  setNewEnvironment(changeEvent.target.value);
                  setEnvironmentError(null);
                }}
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!newEnvironment.trim() || addEnvironment.isPending}
              >
                <Plus />
                添加
              </Button>
            </form>
          ) : null}
        </div>
        <FieldError message={environmentError} />
      </div>
    </section>
  );
}

function AppCreateDialog({
  open,
  onOpenChange,
  isSubmitting,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onCreate: (values: { name: string; slug: string }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const nameError = name.trim() ? null : '名称不能为空';
  const slugError = SLUG_PATTERN.test(slug) ? null : `slug ${SLUG_HINT}`;

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setShowErrors(true);
    if (nameError || slugError) return;
    await onCreate({ name: name.trim(), slug });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="新建应用"
      description="slug 会出现在 app 端拉取的 URL 里,创建后不可改。"
      submitLabel="创建"
      isSubmitting={isSubmitting}
      onSubmit={submit}
    >
      <div className="space-y-2">
        <Label htmlFor="app-name">名称</Label>
        <Input
          id="app-name"
          value={name}
          maxLength={64}
          placeholder="My App"
          autoComplete="off"
          aria-invalid={showErrors && !!nameError}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
        />
          <FieldError message={showErrors ? nameError : null} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="app-slug">Slug</Label>
        <Input
          id="app-slug"
          value={slug}
          maxLength={64}
          placeholder="my-app"
          className="font-mono"
          autoComplete="off"
          aria-invalid={showErrors && !!slugError}
          onChange={(changeEvent) =>
            setSlug(changeEvent.target.value.toLowerCase())
          }
        />
          <FieldError message={showErrors ? slugError : null} />
      </div>
    </FormDialog>
  );
}

function AppRenameDialog({
  app,
  isSubmitting,
  onClose,
  onSave,
}: {
  app: ConfigApp | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSave: (appId: number, name: string) => Promise<void>;
}) {
  const [name, setName] = useState(app?.name ?? '');
  return (
    <FormDialog
      open={app !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="重命名应用"
      description="只改显示名,slug 和 server key 不变。"
      isSubmitting={isSubmitting}
      onSubmit={async (formEvent) => {
        formEvent.preventDefault();
        if (!app || !name.trim()) return;
        await onSave(app.id, name.trim());
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="rename-app">名称</Label>
        <Input
          id="rename-app"
          value={name}
          maxLength={64}
          onChange={(changeEvent) => setName(changeEvent.target.value)}
        />
      </div>
    </FormDialog>
  );
}

// 骨架和 AppCard 同结构:标题、拉取地址、server key、环境
function AppCardSkeleton() {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-8" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </section>
  );
}
