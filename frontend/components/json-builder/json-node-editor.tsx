'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { combineClassNames } from '@/lib/utils';
import {
  addObjectField,
  defaultValueFor,
  getValueAtPath,
  hasChildren,
  inferPresentation,
  insertArrayItem,
  JSON_TYPE_LABELS,
  JSON_TYPE_SYMBOLS,
  JSON_TYPES,
  jsonTypeOf,
  removeValueAtPath,
  renameObjectKey,
  setValueAtPath,
  type JsonObject,
  type JsonPath,
  type JsonType,
  type JsonValue,
} from './json-builder-utils';

// 所有节点共用:拿根和 path,改完把新根抛上去
interface NodeProps {
  root: JsonValue;
  path: JsonPath;
  onChange: (nextRoot: JsonValue) => void;
}

const TYPE_SELECT_ITEMS = JSON_TYPES.map((type) => ({
  value: type,
  label: `${JSON_TYPE_SYMBOLS[type]}  ${JSON_TYPE_LABELS[type]}`,
}));

// 菜单里的一行:符号 + 名字
function TypeOption({ type }: { type: JsonType }) {
  return (
    <>
      <span className="w-6 font-mono text-xs text-muted-foreground">
        {JSON_TYPE_SYMBOLS[type]}
      </span>
      {JSON_TYPE_LABELS[type]}
    </>
  );
}

export function JsonNodeEditor({ root, path, onChange }: NodeProps) {
  const value = getValueAtPath(root, path);
  if (Array.isArray(value)) {
    return <ArrayEditor root={root} path={path} onChange={onChange} />;
  }
  if (value !== null && typeof value === 'object') {
    return <ObjectEditor root={root} path={path} onChange={onChange} />;
  }
  return <PrimitiveEditor root={root} path={path} onChange={onChange} />;
}

// ---------- 对象 ----------

function ObjectEditor({ root, path, onChange }: NodeProps) {
  const value = getValueAtPath(root, path) as JsonObject;
  const entries = Object.entries(value);
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-1">
      {entries.length === 0 && !isAdding && (
        <p className="py-2 text-xs text-muted-foreground">暂无字段</p>
      )}
      {entries.map(([key, child]) => (
        <ObjectFieldRow
          key={key}
          root={root}
          path={[...path, key]}
          fieldKey={key}
          siblingKeys={entries.map(([siblingKey]) => siblingKey)}
          isContainer={child !== null && typeof child === 'object'}
          onChange={onChange}
        />
      ))}
      {isAdding ? (
        <AddFieldForm
          existingKeys={entries.map(([key]) => key)}
          onCancel={() => setIsAdding(false)}
          onAdd={(key, type) => {
            onChange(addObjectField(root, path, key, defaultValueFor(type)));
            setIsAdding(false);
          }}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary"
          onClick={() => setIsAdding(true)}
        >
          <Plus /> 添加字段
        </Button>
      )}
    </div>
  );
}

function ObjectFieldRow({
  root,
  path,
  fieldKey,
  siblingKeys,
  isContainer,
  onChange,
}: NodeProps & {
  fieldKey: string;
  siblingKeys: string[];
  isContainer: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const objectPath = path.slice(0, -1);
  const keyInput = (
    <KeyInput
      value={fieldKey}
      siblingKeys={siblingKeys}
      onRename={(nextKey) =>
        onChange(renameObjectKey(root, objectPath, fieldKey, nextKey))
      }
    />
  );

  if (!isContainer) {
    return (
      <div className="flex items-start gap-2">
        {keyInput}
        <div className="min-w-0 flex-1">
          <PrimitiveEditor root={root} path={path} onChange={onChange} />
        </div>
        <NodeMenu root={root} path={path} onChange={onChange} />
      </div>
    );
  }
  return (
    <ContainerBlock
      root={root}
      path={path}
      onChange={onChange}
      isCollapsed={isCollapsed}
      onToggle={() => setIsCollapsed((current) => !current)}
      title={keyInput}
    />
  );
}

// 可折叠的对象/数组块:标题行 + 缩进的子节点
function ContainerBlock({
  root,
  path,
  onChange,
  isCollapsed,
  onToggle,
  title,
}: NodeProps & {
  isCollapsed: boolean;
  onToggle: () => void;
  title: React.ReactNode;
}) {
  const value = getValueAtPath(root, path);
  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={isCollapsed ? '展开' : '折叠'}
          onClick={onToggle}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
        {title}
        <span className="text-xs text-muted-foreground">
          {describeContainer(value)}
        </span>
        <span className="flex-1" />
        <NodeMenu root={root} path={path} onChange={onChange} />
      </div>
      {!isCollapsed && (
        <div className="ml-3 border-l border-border pl-3">
          <JsonNodeEditor root={root} path={path} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function describeContainer(value: JsonValue): string {
  if (Array.isArray(value)) return `Array · ${value.length} 项`;
  return `Object · ${Object.keys(value as JsonObject).length} 字段`;
}

// 字段名行内改;空或重复时提示并且失焦回退
function KeyInput({
  value,
  siblingKeys,
  onRename,
}: {
  value: string;
  siblingKeys: string[];
  onRename: (nextKey: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const error = validateKey(draft, siblingKeys, value);

  function commit() {
    if (error || draft === value) {
      setDraft(value);
      return;
    }
    onRename(draft);
  }

  return (
    <div className="w-40 shrink-0">
      <Input
        value={draft}
        aria-label="字段名"
        aria-invalid={!!error}
        className="h-8 font-mono text-xs"
        onChange={(changeEvent) => setDraft(changeEvent.target.value)}
        onBlur={commit}
        onKeyDown={(keyEvent) => {
          if (keyEvent.key === 'Enter') keyEvent.currentTarget.blur();
          if (keyEvent.key === 'Escape') setDraft(value);
        }}
      />
      <FieldError message={error} />
    </div>
  );
}

function validateKey(
  candidate: string,
  siblingKeys: string[],
  currentKey?: string,
): string | null {
  if (candidate.length === 0) return '字段名不能为空';
  if (candidate !== currentKey && siblingKeys.includes(candidate)) {
    return '字段名称已经存在';
  }
  return null;
}

function AddFieldForm({
  existingKeys,
  onAdd,
  onCancel,
}: {
  existingKeys: string[];
  onAdd: (key: string, type: JsonType) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [type, setType] = useState<JsonType>('string');
  const [showError, setShowError] = useState(false);
  const error = validateKey(key, existingKeys);

  function submit() {
    setShowError(true);
    if (error) return;
    onAdd(key, type);
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            autoFocus
            value={key}
            placeholder="字段名"
            aria-label="新字段名"
            aria-invalid={showError && !!error}
            className="h-8 font-mono text-xs"
            onChange={(changeEvent) => setKey(changeEvent.target.value)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === 'Enter') {
                keyEvent.preventDefault();
                submit();
              }
              if (keyEvent.key === 'Escape') onCancel();
            }}
          />
          <FieldError message={showError ? error : null} />
        </div>
        <Select
          value={type}
          items={TYPE_SELECT_ITEMS}
          onValueChange={(next) => setType(String(next) as JsonType)}
        >
          <SelectTrigger className="h-8 w-28 text-xs" aria-label="字段类型">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_SELECT_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <TypeOption type={item.value} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={submit}>
          添加
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

// ---------- 数组 ----------

function ArrayEditor({ root, path, onChange }: NodeProps) {
  const value = getValueAtPath(root, path) as JsonValue[];
  return (
    <div className="space-y-1">
      {value.length === 0 && (
        <p className="py-2 text-xs text-muted-foreground">暂无数据</p>
      )}
      {value.map((item, index) => (
        <ArrayItemRow
          // ponytail: 删除中间项后用下标当 key 会让后面的行内状态错位,数据小无所谓
          key={index}
          root={root}
          path={[...path, index]}
          index={index}
          isContainer={item !== null && typeof item === 'object'}
          onChange={onChange}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="sm" className="text-primary" />
          }
        >
          <Plus /> 添加 Item
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {JSON_TYPES.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() =>
                onChange(
                  insertArrayItem(root, path, value.length, defaultValueFor(type)),
                )
              }
            >
              <TypeOption type={type} />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ArrayItemRow({
  root,
  path,
  index,
  isContainer,
  onChange,
}: NodeProps & { index: number; isContainer: boolean }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const value = getValueAtPath(root, path);
  const indexBadge = (
    <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
      #{index + 1}
    </span>
  );

  if (!isContainer) {
    return (
      <div className="flex items-start gap-2">
        <span className="pt-2">{indexBadge}</span>
        <div className="min-w-0 flex-1">
          <PrimitiveEditor root={root} path={path} onChange={onChange} />
        </div>
        <NodeMenu root={root} path={path} onChange={onChange} />
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border p-2">
      <ContainerBlock
        root={root}
        path={path}
        onChange={onChange}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed((current) => !current)}
        title={
          <span className="flex items-center gap-2">
            {indexBadge}
            <span className="text-sm font-medium">{itemTitle(value)}</span>
          </span>
        }
      />
    </div>
  );
}

// 对象项有 name/title 就拿来当标题,一眼能认
function itemTitle(value: JsonValue): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const candidate of ['name', 'title', 'label', 'key']) {
      const field = value[candidate];
      if (typeof field === 'string' && field.length > 0) return field;
    }
  }
  return '';
}

// ---------- 基础类型 ----------

function PrimitiveEditor({ root, path, onChange }: NodeProps) {
  const value = getValueAtPath(root, path);
  const key = path[path.length - 1] ?? '';

  if (typeof value === 'boolean') {
    return (
      <div className="flex h-8 items-center gap-2">
        <Switch
          checked={value}
          aria-label="布尔值"
          onCheckedChange={(checked) =>
            onChange(setValueAtPath(root, path, checked))
          }
        />
        <span className="font-mono text-xs text-muted-foreground">
          {String(value)}
        </span>
      </div>
    );
  }
  if (typeof value === 'number') {
    return (
      <Input
        type="number"
        step="any"
        value={value}
        aria-label="数字值"
        className="h-8 font-mono text-xs"
        onChange={(changeEvent) => {
          const next = Number(changeEvent.target.value);
          if (changeEvent.target.value !== '' && !Number.isNaN(next)) {
            onChange(setValueAtPath(root, path, next));
          }
        }}
      />
    );
  }
  if (value === null) {
    return (
      <span className="inline-flex h-8 items-center font-mono text-xs text-muted-foreground">
        null
      </span>
    );
  }
  const text = value as string;
  const presentation = inferPresentation(key, text);
  return (
    <div className="flex items-center gap-2">
      {presentation === 'image-url' && <ImageThumbnail url={text} />}
      <Input
        value={text}
        aria-label="字符串值"
        className={combineClassNames(
          'h-8 text-xs',
          presentation !== 'text' && 'font-mono',
        )}
        onChange={(changeEvent) =>
          onChange(setValueAtPath(root, path, changeEvent.target.value))
        }
      />
      {presentation !== 'text' && (
        <a
          href={text}
          target="_blank"
          rel="noreferrer"
          aria-label="打开链接"
          className="text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function ImageThumbnail({ url }: { url: string }) {
  const [isBroken, setIsBroken] = useState(false);
  if (isBroken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 用户填的任意外链,不走 next/image
    <img
      src={url}
      alt=""
      className="size-8 shrink-0 rounded-md border border-border object-cover"
      onError={() => setIsBroken(true)}
    />
  );
}

// ---------- ⋯ 菜单:改类型 / 删除 ----------

type PendingAction = { kind: 'delete' } | { kind: 'retype'; type: JsonType };

export function NodeMenu({
  root,
  path,
  onChange,
  onDeleteRoot,
}: NodeProps & { onDeleteRoot?: () => void }) {
  const value = getValueAtPath(root, path);
  const currentType = jsonTypeOf(value);
  const isRoot = path.length === 0;
  const [pending, setPending] = useState<PendingAction | null>(null);

  function apply(action: PendingAction) {
    if (action.kind === 'delete') {
      if (isRoot) onDeleteRoot?.();
      else onChange(removeValueAtPath(root, path));
    } else {
      onChange(setValueAtPath(root, path, defaultValueFor(action.type)));
    }
    setPending(null);
  }

  // 有内容的对象/数组才确认,基础类型直接干
  function request(action: PendingAction) {
    if (hasChildren(value)) setPending(action);
    else apply(action);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="更多操作"
              className="text-muted-foreground"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>改类型</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {JSON_TYPES.filter((type) => type !== currentType).map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => request({ kind: 'retype', type })}
                >
                  <TypeOption type={type} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="focus:bg-destructive/10 focus:text-destructive focus:**:text-destructive"
            onClick={() => request({ kind: 'delete' })}
          >
            {isRoot ? '清空' : '删除'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.kind === 'delete' ? '删除这个节点?' : '替换为新类型?'}
        description={
          pending?.kind === 'delete'
            ? '它下面的所有内容会一起删除。'
            : `改成 ${pending ? JSON_TYPE_LABELS[pending.type] : ''} 后,现有内容会被清空。`
        }
        confirmLabel={pending?.kind === 'delete' ? '删除' : '替换'}
        isPending={false}
        onConfirm={() => {
          if (pending) apply(pending);
        }}
      />
    </>
  );
}
