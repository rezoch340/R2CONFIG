'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Copy,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
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
  // 行内改了但还没点 Update 的值
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const environmentId = activeEnvironment?.id;
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
      body: Partial<Pick<ConfigParameter, 'type' | 'scope' | 'value'>>;
    }) =>
      requestApi<ConfigParameter>(`/config/params/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify(input.body),
      }),
    onSuccess: async (param) => {
      toast.success(`${param.key} 已更新`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[param.id];
        return next;
      });
      setEditingParam(null);
      await invalidate();
    },
    onError: (error) =>
      toast.error(getRequestErrorMessage(error, '更新参数失败')),
  });

  const createMutation = useMutation({
    mutationFn: (body: Pick<ConfigParameter, 'key' | 'type' | 'scope' | 'value'>) =>
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
      if (keyword && !param.key.toLowerCase().includes(keyword)) continue;
      const { group } = splitKey(param.key);
      grouped.set(group, [...(grouped.get(group) ?? []), param]);
    }
    return [...grouped.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [parametersQuery.data, search]);

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
    const isDirty = draft !== undefined && draft !== param.value;
    return (
      <div className="flex items-center gap-2">
        <TypeTile type="string" />
        <Input
          value={draft ?? param.value}
          disabled={!canUpdate}
          aria-label={`${param.key} 的值`}
          className="font-mono text-xs"
          onChange={(changeEvent) =>
            setDrafts((current) => ({
              ...current,
              [param.id]: changeEvent.target.value,
            }))
          }
        />
        <Button
          size="sm"
          variant={isDirty ? 'default' : 'secondary'}
          disabled={!isDirty || updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({ id: param.id, body: { value: draft } })
          }
        >
          保存
        </Button>
        {scopeBadge}
      </div>
    );
  }

  const hasContext = activeApp !== null && activeEnvironment !== null;

  return (
    <PermissionBoundary action="read" subject="config">
      <PageHeader
        eyebrow="Parameters"
        title="参数"
        description={
          hasContext
            ? `管理 ${activeApp.name} / ${activeEnvironment.name} 环境下的配置参数。`
            : '先在顶栏选择应用和环境。'
        }
        actions={
          hasContext && can('create', 'config') ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
                批量导入
              </Button>
              <Button onClick={() => setIsCreateOpen(true)}>新增参数</Button>
            </div>
          ) : undefined
        }
      />

      {!hasContext && !isContextLoading ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          还没有应用。去「应用」页新建一个,会自动带上 dev / prod 两个环境。
        </p>
      ) : null}

      {parametersQuery.isError ? <QueryErrorState /> : null}

      {hasContext ? (
        <>
          <AppHero
            app={activeApp}
            environment={activeEnvironment}
            parameters={parametersQuery.data ?? []}
            groupCount={groupNames.length}
          />

          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder="搜索参数 key…"
              className="pl-8"
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
            />
          </div>

          {parametersQuery.isLoading ? (
            <ParamRowsSkeleton />
          ) : groups.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              {search ? '没有匹配的参数' : '这个环境还没有参数'}
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map(([group, parameters]) => {
                const isCollapsed = collapsedGroups.has(group);
                return (
                  <section
                    key={group}
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    >
                      <GroupIcon group={group} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{group}</span>
                        <span className="block text-xs text-muted-foreground">
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
                                'grid items-center gap-4 border-t px-4 py-3',
                                ROW_GRID,
                              )}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {humanizeKeyName(name)}
                                </p>
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
                                  aria-label={`编辑 ${param.key}`}
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
                                  <DropdownMenuContent align="end">
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
        isSubmitting={updateMutation.isPending}
        onSubmit={async (values) => {
          if (!editingParam) return;
          await updateMutation.mutateAsync({
            id: editingParam.id,
            body: { type: values.type, scope: values.scope, value: values.value },
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

// 顶部应用卡:头像、环境、三个数字;生产环境多一条提醒
function AppHero({
  app,
  environment,
  parameters,
  groupCount,
}: {
  app: ConfigApp;
  environment: ConfigEnvironment;
  parameters: ConfigParameter[];
  groupCount: number;
}) {
  const tone = environmentTone(environment.name);
  const latest = parameters.reduce<string | null>(
    (newest, param) =>
      newest === null || param.updatedAt > newest ? param.updatedAt : newest,
    null,
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-heading text-xl font-semibold text-primary-foreground">
          {app.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">{app.name}</h2>
            <Badge variant="outline" className="gap-1.5 font-mono">
              <span
                className={combineClassNames(
                  'size-1.5 rounded-full',
                  ENVIRONMENT_DOT_CLASS[tone],
                )}
              />
              {environment.name}
            </Badge>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{app.slug}</p>
        </div>
        <dl className="flex gap-6 text-center">
          <HeroStat label="参数" value={String(parameters.length)} />
          <HeroStat label="分组" value={String(groupCount)} />
          <HeroStat label="最近更新" value={formatRelativeTime(latest)} />
        </dl>
      </div>
      {tone === 'production' && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <TriangleAlert className="size-4 shrink-0" />
          你正在编辑生产环境,保存后对所有用户立即生效。
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-14">
      <dd className="font-heading text-lg font-semibold">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
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
            'grid items-center gap-4 border-t px-4 py-3',
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
