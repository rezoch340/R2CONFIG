'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { PermissionBoundary } from '@/components/permission-boundary';
import { QueryErrorState } from '@/components/query-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getRequestErrorMessage, requestApi } from '@/lib/api-client';
import { useAuthentication } from '@/lib/auth';
import { useActiveConfig } from '@/lib/config-context';
import type { ConfigParameter } from '@/lib/models';
import { combineClassNames } from '@/lib/utils';
import { ParamFormDialog, ParamImportDialog } from './param-dialogs';

const UNGROUPED = '默认';

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

  function toggleGroup(group: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function renderValueCell(param: ConfigParameter) {
    if (param.type === 'boolean') {
      const isOn = param.value === 'true';
      return (
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`${param.key} 开关`}
          disabled={!canUpdate || updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({
              id: param.id,
              body: { value: isOn ? 'false' : 'true' },
            })
          }
          className={combineClassNames(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            isOn ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={combineClassNames(
              'inline-block size-5 rounded-full bg-white shadow transition-transform',
              isOn ? 'translate-x-5.5' : 'translate-x-0.5',
            )}
          />
        </button>
      );
    }
    const draft = drafts[param.id];
    const isDirty = draft !== undefined && draft !== param.value;
    const displayValue = draft ?? param.value;
    const commonProps = {
      value: displayValue,
      disabled: !canUpdate,
      className: 'font-mono text-xs',
      onChange: (
        changeEvent: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) =>
        setDrafts((current) => ({
          ...current,
          [param.id]: changeEvent.target.value,
        })),
    };
    return (
      <div className="flex items-start gap-2">
        {param.type === 'json' ? (
          <Textarea rows={2} {...commonProps} />
        ) : (
          <Input {...commonProps} />
        )}
        <Button
          size="sm"
          variant={isDirty ? 'default' : 'secondary'}
          disabled={!isDirty || updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({ id: param.id, body: { value: draft } })
          }
        >
          Update
        </Button>
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
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              placeholder="搜索参数 key…"
              className="pl-8"
              onChange={(changeEvent) => setSearch(changeEvent.target.value)}
            />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="grid grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_120px_100px] gap-4 border-b bg-muted/40 px-4 py-2 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <span>参数</span>
              <span>值</span>
              <span>详情</span>
              <span className="text-right">操作</span>
            </div>
            {parametersQuery.isLoading ? (
              <ParamRowsSkeleton />
            ) : groups.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {search ? '没有匹配的参数' : '这个环境还没有参数'}
              </p>
            ) : (
              groups.map(([group, parameters]) => {
                const isCollapsed = collapsedGroups.has(group);
                return (
                  <section key={group} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/40"
                    >
                      <ChevronRight
                        className={combineClassNames(
                          'size-4 text-muted-foreground transition-transform',
                          isCollapsed ? '' : 'rotate-90',
                        )}
                      />
                      {group}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {parameters.length}
                      </span>
                    </button>
                    {isCollapsed
                      ? null
                      : parameters.map((param) => {
                          const { name } = splitKey(param.key);
                          return (
                            <div
                              key={param.id}
                              className="grid grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_120px_100px] items-start gap-4 border-t px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{name}</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                  {param.key}
                                </p>
                              </div>
                              <div className="min-w-0">{renderValueCell(param)}</div>
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className="w-fit font-mono uppercase">
                                  {param.type}
                                </Badge>
                                <Badge
                                  variant={param.scope === 'private' ? 'warning' : 'outline'}
                                  className="w-fit font-mono uppercase"
                                >
                                  {param.scope}
                                </Badge>
                              </div>
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`编辑 ${param.key}`}
                                  disabled={!canUpdate}
                                  onClick={() => setEditingParam(param)}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={`删除 ${param.key}`}
                                  disabled={!can('delete', 'config')}
                                  onClick={() => setDeletingParam(param)}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                  </section>
                );
              })
            )}
          </div>
        </>
      ) : null}

      <ParamFormDialog
        key={`create-${isCreateOpen}`}
        open={isCreateOpen}
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

// 骨架和真实行同一套网格,加载完不跳版
function ParamRowsSkeleton() {
  return (
    <section>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from(Array(4).keys()).map((rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[minmax(180px,1fr)_minmax(240px,2fr)_120px_100px] items-start gap-4 border-t px-4 py-3"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-8 w-full max-w-md" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex justify-end gap-1">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      ))}
    </section>
  );
}
