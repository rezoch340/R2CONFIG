'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppAvatar } from '@/components/app-avatar';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { PermissionBoundary } from '@/components/permission-boundary';
import { QueryErrorState } from '@/components/query-state';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getRequestErrorMessage, requestApi } from '@/lib/api-client';
import { useAuthentication } from '@/lib/auth';
import { useActiveConfig } from '@/lib/config-context';
import { formatRelativeTime } from '@/lib/format';
import type { ConfigApp, ConfigEnvironment, ConfigParameter } from '@/lib/models';
import { combineClassNames } from '@/lib/utils';
import { ParamFormDialog, ParamImportDialog } from './param-dialogs';
import {
  ENVIRONMENT_DOT_CLASS,
  environmentTone,
  GroupIcon,
  humanizeKeyName,
  JsonPreviewCard,
  TypeTile,
} from './param-presentation';

const UNGROUPED = '默认';
const ROW_GRID = 'grid-cols-[minmax(200px,1fr)_minmax(280px,2fr)_88px]';

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`已复制${label}`),
    () => toast.error('复制失败'),
  );
}

// key 形如 Group:Key,冒号前为分组
function splitKey(key: string): { group: string; name: string } {
  const separatorIndex = key.indexOf(':');
  if (separatorIndex === -1) return { group: UNGROUPED, name: key };
  return {
    group: key.slice(0, separatorIndex),
    name: key.slice(separatorIndex + 1),
  };
}

export default function ParamsPage() {
  const queryClient = useQueryClient();
  const { can } = useAuthentication();
  const { activeApp, activeEnvironment, isLoading: isContextLoading } =
    useActiveConfig();
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [editingParam, setEditingParam] = useState<ConfigParameter | null>(
    null,
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deletingParam, setDeletingParam] = useState<ConfigParameter | null>(
    null,
  );
  // 行内改了但还没保存的值;按环境记,切环境就当没改过
  const [draftState, setDraftState] = useState<{
    environmentId: number | undefined;
    drafts: Record<number, string>;
  }>({ environmentId: undefined, drafts: {} });
  // 哪一行的文本值正处于编辑态
  const [editingValueId, setEditingValueId] = useState<number | null>(null);

  const environmentId = activeEnvironment?.id;
  const drafts =
    draftState.environmentId === environmentId ? draftState.drafts : {};
  const setDraft = (paramId: number, value: string | undefined) =>
    setDraftState((current) => {
      const base =
        current.environmentId === environmentId ? current.drafts : {};
      const next = { ...base };
      if (value === undefined) delete next[paramId];
      else next[paramId] = value;
      return { environmentId, drafts: next };
    });
  const queryKey = ['config-params', environmentId];
  const parametersQuery = useQuery({
    queryKey,
    queryFn: () =>
      requestApi<ConfigParameter[]>(
        `/config/environments/${environmentId}/params`,
      ),
    enabled: environmentId !== undefined,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const canUpdate = can('update', 'config');

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: number;
      body: Partial<
        Pick<ConfigParameter, 'type' | 'scope' | 'value' | 'description'>
      >;
    }) =>
      requestApi<ConfigParameter>(`/config/params/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: async (param) => {
      toast.success(`${param.key} 已更新`);
      setDraft(param.id, undefined);
      setEditingValueId(null);
      setEditingParam(null);
      await invalidate();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '更新参数失败')),
  });

  const createMutation = useMutation({
    mutationFn: (
      body: Pick<
        ConfigParameter,
        'key' | 'type' | 'scope' | 'value' | 'description'
      >,
    ) =>
      requestApi<ConfigParameter>(
        `/config/environments/${environmentId}/params`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: async (param) => {
      toast.success(`${param.key} 已创建`);
      setIsCreateOpen(false);
      await invalidate();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '创建参数失败')),
  });

  const importMutation = useMutation({
    mutationFn: (entries: Record<string, unknown>) =>
      requestApi<{ imported: number }>(
        `/config/environments/${environmentId}/params/import`,
        { method: 'POST', body: JSON.stringify(entries) },
      ),
    onSuccess: async (result) => {
      toast.success(`已导入 ${result.imported} 个参数`);
      setIsImportOpen(false);
      await invalidate();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '导入失败')),
  });

  const deleteMutation = useMutation({
    mutationFn: (paramId: number) =>
      requestApi(`/config/params/${paramId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('参数已删除');
      setDeletingParam(null);
      await invalidate();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '删除参数失败')),
  });

  const groups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const grouped = new Map<string, ConfigParameter[]>();
    for (const param of parametersQuery.data ?? []) {
      if (
        keyword &&
        !param.key.toLowerCase().includes(keyword) &&
        !param.description.toLowerCase().includes(keyword)
      ) {
        continue;
      }
      const { group } = splitKey(param.key);
      grouped.set(group, [...(grouped.get(group) ?? []), param]);
    }
    // 「默认」固定放最前,其余按名字;不同环境的 localeCompare 对中英混排的排法不一样
    return [...grouped.entries()].sort(([left], [right]) => {
      if (left === UNGROUPED) return -1;
      if (right === UNGROUPED) return 1;
      return left.localeCompare(right, 'en');
    });
  }, [parametersQuery.data, search]);

  // 不过滤的分组数,顶部统计用;「默认」也算一组,和下面列表对得上
  const totalGroupCount = useMemo(
    () =>
      new Set((parametersQuery.data ?? []).map((param) => splitKey(param.key).group))
        .size,
    [parametersQuery.data],
  );

  // 已有分组名(不含「默认」),给新增弹窗的下拉用
  const groupNames = useMemo(
    () =>
      [...new Set(
        (parametersQuery.data ?? [])
          .map((param) => splitKey(param.key).group)
          .filter((group) => group !== UNGROUPED),
      )].sort((left, right) => left.localeCompare(right)),
    [parametersQuery.data],
  );

  const allCollapsed =
    groups.length > 0 && groups.every(([group]) => collapsedGroups.has(group));

  function toggleAllGroups() {
    setCollapsedGroups(
      allCollapsed ? new Set() : new Set(groups.map(([group]) => group)),
    );
  }

  function toggleGroup(group: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function renderValueCell(param: ConfigParameter) {
    const scopeBadge = (
      <Badge
        variant={param.scope === 'private' ? 'warning' : 'outline'}
        className="font-mono text-[10px] uppercase"
      >
        {param.scope}
      </Badge>
    );
    if (param.type === 'boolean') {
      const isOn = param.value === 'true';
      return (
        <div className="flex h-10 items-center gap-3">
          <Switch
            checked={isOn}
            aria-label={`${param.key} 开关`}
            disabled={!canUpdate || updateMutation.isPending}
            onCheckedChange={(checked) =>
              updateMutation.mutate({
                id: param.id,
                body: { value: checked ? 'true' : 'false' },
              })
            }
          />
          <span className="text-sm text-muted-foreground">
            {isOn ? '开启' : '关闭'}
          </span>
          {scopeBadge}
        </div>
      );
    }
    if (param.type === 'json') {
      return (
        <JsonPreviewCard
          source={param.value}
          scopeBadge={scopeBadge}
          disabled={!canUpdate}
          onOpen={() => setEditingParam(param)}
        />
      );
    }
    const draft = drafts[param.id];
    const isEditingValue = editingValueId === param.id;
    const isDirty = draft !== undefined && draft !== param.value;
    const cancelEdit = () => {
      setDraft(param.id, undefined);
      setEditingValueId(null);
    };
    const saveEdit = () => {
      if (!isDirty) return;
      updateMutation.mutate({ id: param.id, body: { value: draft } });
    };
    if (!isEditingValue) {
      return (
        <div className="flex items-center gap-2">
          <TypeTile type="string" />
          <button
            type="button"
            disabled={!canUpdate}
            aria-label={`编辑 ${param.key} 的值`}
            onClick={() => setEditingValueId(param.id)}
            className="group/value flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {param.value || <span className="text-muted-foreground">(空)</span>}
            </span>
            <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/value:opacity-100" />
          </button>
          {scopeBadge}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <TypeTile type="string" />
        <Input
          autoFocus
          value={draft ?? param.value}
          aria-label={`${param.key} 的值`}
          className="font-mono text-xs"
          onChange={(changeEvent) => setDraft(param.id, changeEvent.target.value)}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === 'Enter') {
              keyEvent.preventDefault();
              saveEdit();
            }
            if (keyEvent.key === 'Escape') cancelEdit();
          }}
        />
        <Button
          size="sm"
          disabled={!isDirty || updateMutation.isPending}
          onClick={saveEdit}
        >
          {updateMutation.isPending && isDirty ? '保存中…' : '保存'}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelEdit}>
          取消
        </Button>
        {scopeBadge}
      </div>
    );
  }

  const hasContext = activeApp !== null && activeEnvironment !== null;
  const dialogTarget = hasContext
    ? {
        label: `${activeApp.name} / ${activeEnvironment.name}`,
        isProduction: environmentTone(activeEnvironment.name) === 'production',
      }
    : undefined;

  return (
    <PermissionBoundary action="read" subject="config">
      {hasContext ? (
        <ParametersHeader
          app={activeApp}
          environment={activeEnvironment}
          parameterCount={parametersQuery.data?.length}
          groupCount={totalGroupCount}
          latestUpdatedAt={latestUpdatedAt(parametersQuery.data)}
          actions={
            can('create', 'config') ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
                  批量导入
                </Button>
                <Button onClick={() => setIsCreateOpen(true)}>新增参数</Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <PageHeader
          eyebrow="Parameters"
          title="参数"
          description="先在顶栏选择应用和环境。"
        />
      )}

      {!hasContext && !isContextLoading ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          还没有应用。去「应用」页新建一个,会自动带上 dev / prod 两个环境。
        </p>
      ) : null}

      {parametersQuery.isError ? (
        <QueryErrorState onRetry={() => void parametersQuery.refetch()} />
      ) : null}

      {hasContext ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                aria-label="搜索参数"
                placeholder="搜索参数 key 或描述…"
                className="pl-8"
                onChange={(changeEvent) => setSearch(changeEvent.target.value)}
              />
            </div>
            {search && parametersQuery.data && (
              <span className="text-sm text-muted-foreground">
                匹配 {groups.reduce((sum, [, parameters]) => sum + parameters.length, 0)}{' '}
                / {parametersQuery.data.length}
              </span>
            )}
            {groups.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={toggleAllGroups}
              >
                {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}
                {allCollapsed ? '全部展开' : '全部折叠'}
              </Button>
            )}
          </div>

          {parametersQuery.isLoading ? (
            <ParamRowsSkeleton />
          ) : parametersQuery.isError ? null : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
              {search ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    没有匹配「{search.trim()}」的参数
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                    清除搜索
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {activeEnvironment.name} 环境还没有参数
                  </p>
                  {can('create', 'config') && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                        新增参数
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setIsImportOpen(true)}>
                        批量导入
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(([group, parameters]) => {
                const isCollapsed = collapsedGroups.has(group);
                return (
                  <section
                    key={group}
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleGroup(group)}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/40"
                    >
                      <GroupIcon group={group} />
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">{group}</span>
                        <span className="text-xs text-muted-foreground">
                          {parameters.length} 个参数
                        </span>
                      </span>
                      <ChevronRight
                        className={combineClassNames(
                          'size-4 text-muted-foreground transition-transform',
                          isCollapsed ? '' : 'rotate-90',
                        )}
                      />
                    </button>
                    {isCollapsed
                      ? null
                      : parameters.map((param) => {
                          const { name } = splitKey(param.key);
                          return (
                            <div
                              key={param.id}
                              className={combineClassNames(
                                'grid items-center gap-4 border-t px-4 py-2.5',
                                ROW_GRID,
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {humanizeKeyName(name)}
                                </p>
                                {param.description && (
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
                                    {param.description}
                                  </p>
                                )}
                                <p className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                  <span className="truncate">{param.key}</span>
                                  <button
                                    type="button"
                                    aria-label={`复制 ${param.key}`}
                                    onClick={() => copyText(param.key, ' key')}
                                    className="shrink-0 rounded p-0.5 hover:text-foreground"
                                  >
                                    <Copy className="size-3" />
                                  </button>
                                </p>
                              </div>
                              <div className="min-w-0">{renderValueCell(param)}</div>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={`编辑参数 ${param.key}`}
                                  title="编辑参数"
                                  disabled={!canUpdate}
                                  onClick={() => setEditingParam(param)}
                                >
                                  <Pencil />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    render={
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label={`${param.key} 更多操作`}
                                      />
                                    }
                                  >
                                    <MoreVertical />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-auto min-w-44">
                                    <DropdownMenuItem
                                      onClick={() => copyText(param.key, ' key')}
                                    >
                                      <Copy /> 复制 key
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => copyText(param.value, '值')}
                                    >
                                      <Copy /> 复制值
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {/* 删除默认中性,悬停才变红 */}
                                    <DropdownMenuItem
                                      className="focus:bg-destructive/10 focus:text-destructive focus:**:text-destructive"
                                      disabled={!can('delete', 'config')}
                                      onClick={() => setDeletingParam(param)}
                                    >
                                      <Trash2 /> 删除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })}
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}

      <ParamFormDialog
        key={`create-${isCreateOpen}`}
        open={isCreateOpen}
        groups={groupNames}
        target={dialogTarget}
        onOpenChange={setIsCreateOpen}
        isSubmitting={createMutation.isPending}
        onSubmit={async (values) => {
          await createMutation.mutateAsync(values);
        }}
      />
      <ParamFormDialog
        key={`edit-${editingParam?.id ?? 'closed'}`}
        open={editingParam !== null}
        onOpenChange={(open) => {
          if (!open) setEditingParam(null);
        }}
        param={editingParam}
        groups={groupNames}
        target={dialogTarget}
        isSubmitting={updateMutation.isPending}
        onSubmit={async (values) => {
          if (!editingParam) return;
          await updateMutation.mutateAsync({
            id: editingParam.id,
            body: {
              type: values.type,
              scope: values.scope,
              value: values.value,
              description: values.description,
            },
          });
        }}
      />
      <ParamImportDialog
        key={`import-${isImportOpen}`}
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        isSubmitting={importMutation.isPending}
        onSubmit={async (entries) => {
          await importMutation.mutateAsync(entries);
        }}
      />
      <ConfirmDialog
        open={deletingParam !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingParam(null);
        }}
        title="删除参数"
        description={`确定删除 ${deletingParam?.key ?? ''}?app 端下次拉取就拿不到它了。`}
        confirmLabel="删除"
        destructive
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingParam && deleteMutation.mutate(deletingParam.id)}
      />
    </PermissionBoundary>
  );
}

function latestUpdatedAt(parameters: ConfigParameter[] | undefined): string | null {
  if (!parameters || parameters.length === 0) return null;
  return parameters.reduce(
    (newest, param) => (param.updatedAt > newest ? param.updatedAt : newest),
    parameters[0].updatedAt,
  );
}

// 标题、上下文、统计合成一行:头像 + 应用名 + 环境 + 一行小字;生产环境多一条提醒
function ParametersHeader({
  app,
  environment,
  parameterCount,
  groupCount,
  latestUpdatedAt: latest,
  actions,
}: {
  app: ConfigApp;
  environment: ConfigEnvironment;
  parameterCount: number | undefined;
  groupCount: number;
  latestUpdatedAt: string | null;
  actions?: React.ReactNode;
}) {
  const tone = environmentTone(environment.name);
  const summary =
    parameterCount === undefined
      ? '参数加载中…'
      : `${parameterCount} 个参数 · ${groupCount} 个分组 · 最近更新 ${formatRelativeTime(latest)}`;
  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <AppAvatar name={app.name} slug={app.slug} enabled={app.enabled} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
                {app.name}
              </h1>
              <Badge variant="outline" className="gap-1.5 font-mono">
                <span
                  className={combineClassNames(
                    'size-1.5 rounded-full',
                    ENVIRONMENT_DOT_CLASS[tone],
                  )}
                />
                {environment.name}
              </Badge>
              {!app.enabled && <Badge variant="secondary">已停用</Badge>}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              <span className="font-mono text-xs">{app.slug}</span> · {summary}
            </p>
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {tone === 'production' && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" />
          你正在编辑 {app.name} 的生产环境,保存后对所有用户立即生效。
        </div>
      )}
    </div>
  );
}

// 骨架和真实行同一套网格,加载完不跳版
function ParamRowsSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-8 rounded-md" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      {Array.from(Array(4).keys()).map((rowIndex) => (
        <div
          key={rowIndex}
          className={combineClassNames(
            'grid items-center gap-4 border-t px-4 py-2.5',
            ROW_GRID,
          )}
        >
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex justify-end gap-1">
            <Skeleton className="size-7" />
            <Skeleton className="size-7" />
          </div>
        </div>
      ))}
    </section>
  );
}
