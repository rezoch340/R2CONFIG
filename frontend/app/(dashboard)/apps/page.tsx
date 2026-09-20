'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CopyButton } from '@/components/copy-button';
import { FieldError } from '@/components/field-error';
import { FormDialog } from '@/components/form-dialog';
import { PageHeader } from '@/components/page-header';
import { PermissionBoundary } from '@/components/permission-boundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  getRequestErrorMessage,
  requestApi,
  resolveApiBaseUrl,
} from '@/lib/api-client';
import { useAuthentication } from '@/lib/auth';
import { useActiveConfig } from '@/lib/config-context';
import { ENVIRONMENT_DOT_CLASS, environmentTone } from '@/lib/environment-tone';
import { formatDateTime } from '@/lib/format';
import type { ConfigApp, ConfigEnvironment } from '@/lib/models';
import { combineClassNames } from '@/lib/utils';

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_HINT = '只能是小写字母、数字和连字符,例如 my-app';
const DESCRIPTION_MAX = 200;

// 应用图标底色:按 slug 哈希,故意不放灰色系——灰是「已停用」专用,不能撞
const APP_TILE_CLASSES = [
  'bg-indigo-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-sky-500 text-white',
  'bg-violet-500 text-white',
  'bg-teal-500 text-white',
  'bg-orange-500 text-white',
];
const DISABLED_TILE_CLASS = 'border bg-muted text-muted-foreground';

function appTileClass(slug: string): string {
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return APP_TILE_CLASSES[Math.abs(hash) % APP_TILE_CLASSES.length];
}

type SortKey = 'created' | 'name';
const SORT_ITEMS: Array<{ value: SortKey; label: string }> = [
  { value: 'created', label: '按创建时间' },
  { value: 'name', label: '按名称' },
];

type Confirmation =
  | { type: 'delete-app'; app: ConfigApp }
  | { type: 'rotate-key'; app: ConfigApp }
  | { type: 'delete-env'; app: ConfigApp; environment: ConfigEnvironment };

type AppPatch = Partial<Pick<ConfigApp, 'name' | 'description' | 'enabled'>>;

export default function AppsPage() {
  const queryClient = useQueryClient();
  const { can } = useAuthentication();
  const { apps, isLoading } = useActiveConfig();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ConfigApp | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');

  const invalidateApps = () =>
    queryClient.invalidateQueries({ queryKey: ['config-apps'] });

  const visibleApps = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? apps.filter(
          (app) =>
            app.name.toLowerCase().includes(keyword) ||
            app.slug.includes(keyword) ||
            app.description.toLowerCase().includes(keyword),
        )
      : apps;
    if (sortKey === 'name') {
      return [...filtered].sort((left, right) =>
        left.name.localeCompare(right.name, 'zh-CN'),
      );
    }
    // 接口本来就按 id 升序 = 创建时间;新建的放前面更顺手
    return [...filtered].reverse();
  }, [apps, search, sortKey]);

  const createMutation = useMutation({
    mutationFn: (body: { name: string; slug: string; description: string }) =>
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

  const patchMutation = useMutation({
    mutationFn: (input: { id: number; body: AppPatch }) =>
      requestApi<ConfigApp>(`/config/apps/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: async (app, input) => {
      toast.success(
        input.body.enabled === undefined
          ? '应用已更新'
          : app.enabled
            ? `${app.name} 已启用`
            : `${app.name} 已停用,app 端拉取会得到 404`,
      );
      setEditingApp(null);
      await invalidateApps();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '更新应用失败')),
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
        eyebrow="Applications"
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
          {Array.from(Array(6).keys()).map((cardIndex) => (
            <AppCardSkeleton key={cardIndex} />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          还没有应用,点右上角新建一个。
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                placeholder="搜索名称、slug 或描述…"
                className="pl-8"
                onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {search ? `${visibleApps.length} / ${apps.length}` : apps.length} 个应用
            </span>
            <Select
              value={sortKey}
              items={SORT_ITEMS}
              onValueChange={(value) => setSortKey(value as SortKey)}
            >
              <SelectTrigger size="sm" className="ml-auto w-36" aria-label="排序">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  isPatching={patchMutation.isPending}
                  onEdit={() => setEditingApp(app)}
                  onToggleEnabled={(enabled) =>
                    patchMutation.mutate({ id: app.id, body: { enabled } })
                  }
                  onConfirm={setConfirmation}
                />
              ))}
            </div>
          )}
        </>
      )}

      <AppFormDialog
        key={`create-${isCreateOpen}`}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        isSubmitting={createMutation.isPending}
        onSubmit={async (values) => {
          await createMutation.mutateAsync(values);
        }}
      />
      <AppFormDialog
        key={`edit-${editingApp?.id ?? 'closed'}`}
        open={editingApp !== null}
        app={editingApp}
        onOpenChange={(open) => {
          if (!open) setEditingApp(null);
        }}
        isSubmitting={patchMutation.isPending}
        onSubmit={async (values) => {
          if (!editingApp) return;
          await patchMutation.mutateAsync({
            id: editingApp.id,
            body: { name: values.name, description: values.description },
          });
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
  isPatching,
  onEdit,
  onToggleEnabled,
  onConfirm,
}: {
  app: ConfigApp;
  isPatching: boolean;
  onEdit: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onConfirm: (confirmation: Confirmation) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useAuthentication();
  const { selectApp } = useActiveConfig();
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [isAddingEnvironment, setIsAddingEnvironment] = useState(false);
  const [newEnvironment, setNewEnvironment] = useState('');
  const [environmentError, setEnvironmentError] = useState<string | null>(
    null,
  );
  const canUpdate = can('update', 'config');
  const endpointPath = `/v1/config/${app.slug}/{env}`;

  const addEnvironment = useMutation({
    mutationFn: (name: string) =>
      requestApi<ConfigEnvironment>(`/config/apps/${app.id}/environments`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (environment) => {
      toast.success(`环境 ${environment.name} 已添加`);
      setNewEnvironment('');
      setIsAddingEnvironment(false);
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

  function openParams() {
    selectApp(app.id);
    router.push('/params');
  }

  return (
    <section
      className={combineClassNames(
        'flex flex-col gap-4 rounded-xl border bg-card p-4 transition-opacity',
        !app.enabled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={combineClassNames(
            'flex size-11 shrink-0 items-center justify-center rounded-xl font-heading text-lg font-semibold',
            app.enabled ? appTileClass(app.slug) : DISABLED_TILE_CLASS,
          )}
        >
          {app.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{app.name}</h2>
            {app.enabled ? (
              <Badge variant="outline" className="gap-1.5 text-xs">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                启用
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                已停用
              </Badge>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {app.slug}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={app.enabled}
            aria-label={app.enabled ? '停用应用' : '启用应用'}
            disabled={!canUpdate || isPatching}
            onCheckedChange={onToggleEnabled}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`${app.name} 更多操作`}
                  className="text-muted-foreground"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!canUpdate} onClick={onEdit}>
                <Pencil /> 编辑名称与描述
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!canUpdate}
                onClick={() => onConfirm({ type: 'rotate-key', app })}
              >
                <RefreshCw /> 重置 server key
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="focus:bg-destructive/10 focus:text-destructive focus:**:text-destructive"
                disabled={!can('delete', 'config')}
                onClick={() => onConfirm({ type: 'delete-app', app })}
              >
                <Trash2 /> 删除应用
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {app.description && (
        <p className="-mt-1 line-clamp-2 text-sm text-muted-foreground">
          {app.description}
        </p>
      )}

      <div className="space-y-1.5">
        <SectionLabel>Endpoint</SectionLabel>
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
          <Badge variant="secondary" className="font-mono text-[10px]">
            GET
          </Badge>
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {endpointPath}
          </code>
          <CopyButton
            value={`${resolveApiBaseUrl()}${endpointPath}`}
            label="复制拉取地址"
            successMessage="已复制拉取地址"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Server key</SectionLabel>
        <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {isKeyVisible ? app.serverKey : '•'.repeat(24)}
          </code>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={isKeyVisible ? '隐藏 server key' : '显示 server key'}
            onClick={() => setIsKeyVisible((current) => !current)}
          >
            {isKeyVisible ? <EyeOff /> : <Eye />}
          </Button>
          <CopyButton value={app.serverKey} label="复制 server key" />
        </div>
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Environments · {app.environments.length}</SectionLabel>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {app.environments.map((environment) => (
            <span
              key={environment.id}
              className="group/env inline-flex items-center gap-1.5 text-sm"
            >
              <span
                className={combineClassNames(
                  'size-2 rounded-full',
                  ENVIRONMENT_DOT_CLASS[environmentTone(environment.name)],
                )}
              />
              <span className="font-mono text-xs">{environment.name}</span>
              {can('delete', 'config') && (
                <button
                  type="button"
                  aria-label={`删除环境 ${environment.name}`}
                  className="rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/env:opacity-100 hover:text-destructive focus-visible:opacity-100"
                  onClick={() =>
                    onConfirm({ type: 'delete-env', app, environment })
                  }
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
          {can('create', 'config') &&
            (isAddingEnvironment ? (
              <form className="flex items-center gap-1" onSubmit={submitEnvironment}>
                <Input
                  autoFocus
                  value={newEnvironment}
                  placeholder="staging"
                  maxLength={32}
                  className="h-7 w-28 font-mono text-xs"
                  aria-invalid={!!environmentError}
                  onChange={(changeEvent) => {
                    setNewEnvironment(changeEvent.target.value);
                    setEnvironmentError(null);
                  }}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === 'Escape') setIsAddingEnvironment(false);
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={!newEnvironment.trim() || addEnvironment.isPending}
                >
                  添加
                </Button>
              </form>
            ) : (
              <button
                type="button"
                aria-label="添加环境"
                className="inline-flex size-6 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary"
                onClick={() => setIsAddingEnvironment(true)}
              >
                <Plus className="size-3.5" />
              </button>
            ))}
        </div>
        <FieldError message={environmentError} />
      </div>

      <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>创建于 {formatDateTime(app.createdAt).slice(0, 16)}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={openParams}
        >
          查看参数 <ArrowRight className="size-3.5" />
        </button>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

// 新建和编辑共用;传了 app 就是编辑,slug 不可改
function AppFormDialog({
  open,
  app,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  app?: ConfigApp | null;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (values: {
    name: string;
    slug: string;
    description: string;
  }) => Promise<void>;
}) {
  const isEditing = !!app;
  const [name, setName] = useState(app?.name ?? '');
  const [slug, setSlug] = useState(app?.slug ?? '');
  const [description, setDescription] = useState(app?.description ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const nameError = name.trim() ? null : '名称不能为空';
  const slugError =
    isEditing || SLUG_PATTERN.test(slug) ? null : `slug ${SLUG_HINT}`;

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setShowErrors(true);
    if (nameError || slugError) return;
    await onSubmit({ name: name.trim(), slug, description: description.trim() });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? '编辑应用' : '新建应用'}
      description={
        isEditing
          ? 'slug 和 server key 不变。'
          : 'slug 会出现在 app 端拉取的 URL 里,创建后不可改。'
      }
      submitLabel={isEditing ? '保存' : '创建'}
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
          disabled={isEditing}
          aria-invalid={showErrors && !!slugError}
          onChange={(changeEvent) =>
            setSlug(changeEvent.target.value.toLowerCase())
          }
        />
        <FieldError message={showErrors ? slugError : null} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="app-description">描述</Label>
        <Textarea
          id="app-description"
          value={description}
          rows={2}
          maxLength={DESCRIPTION_MAX}
          placeholder="这个应用是干什么的,给同事看的"
          onChange={(changeEvent) => setDescription(changeEvent.target.value)}
        />
      </div>
    </FormDialog>
  );
}

// 骨架和 AppCard 同结构
function AppCardSkeleton() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
      <div className="flex justify-between border-t pt-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    </section>
  );
}
