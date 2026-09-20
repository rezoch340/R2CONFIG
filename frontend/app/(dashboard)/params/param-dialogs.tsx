'use client';

import { useState } from 'react';
import { FieldError } from '@/components/field-error';
import { FormDialog } from '@/components/form-dialog';
import { JsonBuilder } from '@/components/json-builder/json-builder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  ConfigParameter,
  ConfigParamScope,
  ConfigParamType,
} from '@/lib/models';

const KEY_PATTERN = /^[A-Za-z0-9_.-]+(:[A-Za-z0-9_.-]+)*$/;
const SEGMENT_PATTERN = /^[A-Za-z0-9_.-]+$/;
const SEGMENT_HINT = '只能包含字母、数字、_ . -';
// 下拉里的两个特殊项
const NO_GROUP = '__none__';
const NEW_GROUP = '__new__';

function validateSegment(segment: string): string | null {
  return SEGMENT_PATTERN.test(segment.trim()) ? null : SEGMENT_HINT;
}

function validateValue(type: ConfigParamType, value: string): string | null {
  if (type !== 'json') return null;
  try {
    JSON.parse(value);
    return null;
  } catch {
    return '值不是合法 JSON';
  }
}

// 新增和编辑共用;传了 param 就是编辑,key 不可改
export function ParamFormDialog({
  open,
  onOpenChange,
  param,
  groups,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  param?: ConfigParameter | null;
  // 当前环境已有的分组,给下拉用;新组在下拉里选「新建分组」再手打一次
  groups: string[];
  isSubmitting: boolean;
  onSubmit: (values: {
    key: string;
    type: ConfigParamType;
    scope: ConfigParamScope;
    value: string;
  }) => Promise<void>;
}) {
  const isEditing = !!param;
  const [group, setGroup] = useState(() =>
    groups.length > 0 ? groups[0] : NEW_GROUP,
  );
  const [newGroup, setNewGroup] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<ConfigParamType>(param?.type ?? 'text');
  const [scope, setScope] = useState<ConfigParamScope>(
    param?.scope ?? 'public',
  );
  const [value, setValue] = useState(param?.value ?? '');
  // 提交过一次后才显示错误,避免刚打开就一片红
  const [showErrors, setShowErrors] = useState(false);
  const resolvedGroup = group === NEW_GROUP ? newGroup.trim() : group;
  const groupError =
    isEditing || group === NO_GROUP ? null : validateSegment(resolvedGroup);
  const nameError = isEditing ? null : validateSegment(name);
  const valueError = validateValue(type, value);
  const composedKey =
    group === NO_GROUP ? name.trim() : `${resolvedGroup}:${name.trim()}`;

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setShowErrors(true);
    if (groupError || nameError || valueError) return;
    await onSubmit({
      key: isEditing ? param.key : composedKey,
      type,
      scope,
      value: type === 'boolean' ? (value === 'true' ? 'true' : 'false') : value,
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? '编辑参数' : '新增参数'}
      description={
        isEditing
          ? 'key 不可修改;改类型时请同时把值改成对应格式。'
          : '先选分组再填参数名,同组参数会折叠在一起。'
      }
      submitLabel={isEditing ? '保存' : '创建'}
      isSubmitting={isSubmitting}
      onSubmit={submit}
      contentClassName={
        type === 'json'
          ? 'sm:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto'
          : undefined
      }
    >
      {isEditing ? (
        <div className="space-y-2">
          <Label htmlFor="param-key">Key</Label>
          <Input
            id="param-key"
            value={param.key}
            disabled
            className="font-mono"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>分组</Label>
            <Select
              value={group}
              items={[
                ...groups.map((existing) => ({ value: existing, label: existing })),
                { value: NEW_GROUP, label: '＋ 新建分组' },
                { value: NO_GROUP, label: '（不分组）' },
              ]}
              onValueChange={(next) => setGroup(String(next))}
            >
              <SelectTrigger className="w-full font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((existing) => (
                  <SelectItem key={existing} value={existing} className="font-mono">
                    {existing}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_GROUP}>＋ 新建分组</SelectItem>
                <SelectItem value={NO_GROUP}>（不分组）</SelectItem>
              </SelectContent>
            </Select>
            {group === NEW_GROUP ? (
              <Input
                value={newGroup}
                maxLength={64}
                placeholder="App"
                className="font-mono"
                autoComplete="off"
                aria-invalid={showErrors && !!groupError}
                onChange={(changeEvent) => setNewGroup(changeEvent.target.value)}
              />
            ) : null}
            <FieldError message={showErrors ? groupError : null} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="param-name">参数名</Label>
            <Input
              id="param-name"
              value={name}
              maxLength={64}
              placeholder="MinVersion"
              className="font-mono"
              autoComplete="off"
              aria-invalid={showErrors && !!nameError}
              onChange={(changeEvent) => setName(changeEvent.target.value)}
            />
            <FieldError message={showErrors ? nameError : null} />
          </div>
          <p className="col-span-2 -mt-2 font-mono text-xs text-muted-foreground">
            key = {composedKey || '…'}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>类型</Label>
          <Select
            value={type}
            onValueChange={(next) => {
              const nextType = String(next) as ConfigParamType;
              setType(nextType);
              if (nextType === 'boolean') setValue('false');
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">text</SelectItem>
              <SelectItem value="boolean">boolean</SelectItem>
              <SelectItem value="json">json</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>可见范围</Label>
          <Select
            value={scope}
            onValueChange={(next) => setScope(String(next) as ConfigParamScope)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">public · 无需凭证可读</SelectItem>
              <SelectItem value="private">private · 仅 server key</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        {type !== 'json' && <Label htmlFor="param-value">值</Label>}
        {type === 'boolean' ? (
          <Select value={value} onValueChange={(next) => setValue(String(next))}>
            <SelectTrigger id="param-value" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        ) : type === 'json' ? (
          <JsonBuilder
            value={value}
            onChange={setValue}
            header={<Label>值</Label>}
          />
        ) : (
          <Textarea
            id="param-value"
            value={value}
            rows={2}
            className="font-mono text-xs"
            onChange={(changeEvent) => setValue(changeEvent.target.value)}
          />
        )}
        {type !== 'json' && <FieldError message={showErrors ? valueError : null} />}
      </div>
    </FormDialog>
  );
}

export function ParamImportDialog({
  open,
  onOpenChange,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (entries: Record<string, unknown>) => Promise<void>;
}) {
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError('不是合法 JSON');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setError('顶层必须是对象:{ "Group:Key": 值 }');
      return;
    }
    const invalidKey = Object.keys(parsed).find(
      (entryKey) => !KEY_PATTERN.test(entryKey),
    );
    if (invalidKey) {
      setError(`key 不合法:${invalidKey}`);
      return;
    }
    setError(null);
    await onSubmit(parsed as Record<string, unknown>);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="批量导入"
      description="贴一个 JSON 对象;已存在的 key 会被覆盖,类型按值自动推断。"
      submitLabel="导入"
      isSubmitting={isSubmitting}
      onSubmit={submit}
    >
      <Textarea
        value={raw}
        rows={12}
        className="font-mono text-xs"
        placeholder={'{\n  "App:MinVersion": "3.0.0",\n  "Features:OfflineMode": true,\n  "App:Announcement": { "visible": true }\n}'}
        aria-invalid={!!error}
        onChange={(changeEvent) => {
          setRaw(changeEvent.target.value);
          setError(null);
        }}
      />
      <FieldError message={error} />
    </FormDialog>
  );
}
