'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog } from '@/components/form-dialog';
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

// 新增和编辑共用;传了 param 就是编辑,key 不可改
export function ParamFormDialog({
  open,
  onOpenChange,
  param,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  param?: ConfigParameter | null;
  isSubmitting: boolean;
  onSubmit: (values: {
    key: string;
    type: ConfigParamType;
    scope: ConfigParamScope;
    value: string;
  }) => Promise<void>;
}) {
  const isEditing = !!param;
  const [key, setKey] = useState(param?.key ?? '');
  const [type, setType] = useState<ConfigParamType>(param?.type ?? 'text');
  const [scope, setScope] = useState<ConfigParamScope>(
    param?.scope ?? 'public',
  );
  const [value, setValue] = useState(param?.value ?? '');

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const trimmedKey = key.trim();
    if (!KEY_PATTERN.test(trimmedKey)) {
      toast.error('key 只能包含字母、数字、_ . -,分组用冒号分隔,例如 App:MinVersion');
      return;
    }
    if (type === 'json') {
      try {
        JSON.parse(value);
      } catch {
        toast.error('值不是合法 JSON');
        return;
      }
    }
    await onSubmit({
      key: trimmedKey,
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
          : '用 Group:Key 命名,同组参数会折叠在一起。'
      }
      submitLabel={isEditing ? '保存' : '创建'}
      isSubmitting={isSubmitting}
      onSubmit={submit}
    >
      <div className="space-y-2">
        <Label htmlFor="param-key">Key</Label>
        <Input
          id="param-key"
          value={key}
          maxLength={128}
          disabled={isEditing}
          placeholder="App:MinVersion"
          className="font-mono"
          autoComplete="off"
          onChange={(changeEvent) => setKey(changeEvent.target.value)}
        />
      </div>
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
        <Label htmlFor="param-value">值</Label>
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
        ) : (
          <Textarea
            id="param-value"
            value={value}
            rows={type === 'json' ? 6 : 2}
            className="font-mono text-xs"
            placeholder={type === 'json' ? '{"visible": true}' : ''}
            onChange={(changeEvent) => setValue(changeEvent.target.value)}
          />
        )}
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

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.error('不是合法 JSON');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast.error('顶层必须是对象:{ "Group:Key": 值 }');
      return;
    }
    const invalidKey = Object.keys(parsed).find((entryKey) => !KEY_PATTERN.test(entryKey));
    if (invalidKey) {
      toast.error(`key 不合法:${invalidKey}`);
      return;
    }
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
        onChange={(changeEvent) => setRaw(changeEvent.target.value)}
      />
    </FormDialog>
  );
}
