'use client';

import { useMemo, useState } from 'react';
import { Braces, Hash, List, Type } from 'lucide-react';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { combineClassNames } from '@/lib/utils';
import {
  defaultValueFor,
  describeJsonError,
  JSON_TYPE_LABELS,
  jsonTypeOf,
  type JsonType,
  type JsonValue,
} from './json-builder-utils';
import { JsonNodeEditor, NodeMenu } from './json-node-editor';

// 对外只认字符串:空串 = 还没创建;可视化模式每次改动都序列化回去,原文模式直接透传
type ParseResult =
  | { status: 'blank' }
  | { status: 'ok'; data: JsonValue }
  | { status: 'error'; message: string };

function parseSource(source: string): ParseResult {
  if (source.trim() === '') return { status: 'blank' };
  try {
    return { status: 'ok', data: JSON.parse(source) as JsonValue };
  } catch (error) {
    return { status: 'error', message: describeJsonError(source, error) };
  }
}

const ROOT_TYPE_CHOICES: Array<{ type: JsonType; icon: React.ReactNode }> = [
  { type: 'object', icon: <Braces /> },
  { type: 'array', icon: <List /> },
  { type: 'string', icon: <Type /> },
  { type: 'number', icon: <Hash /> },
];

export function JsonBuilder({
  value,
  onChange,
  header,
}: {
  value: string;
  onChange: (next: string) => void;
  // 放在工具条左边的内容,一般是 <Label>值</Label>
  header?: React.ReactNode;
}) {
  const parsed = useMemo(() => parseSource(value), [value]);
  const [mode, setMode] = useState<'visual' | 'raw'>(() =>
    parsed.status === 'error' ? 'raw' : 'visual',
  );
  // 原文非法时不允许切回可视化,错误留在原文下面
  const [switchError, setSwitchError] = useState<string | null>(null);
  const showVisual = mode === 'visual' && parsed.status !== 'error';

  function emit(next: JsonValue) {
    onChange(JSON.stringify(next, null, 2));
  }

  function switchToVisual() {
    if (parsed.status === 'error') {
      setSwitchError(parsed.message);
      return;
    }
    setSwitchError(null);
    setMode('visual');
  }

  return (
    <div className="space-y-2">
      <div className="flex h-7 items-center justify-between">
        {header ?? <span />}
        <div className="flex rounded-md bg-muted p-0.5">
          <ModeButton active={showVisual} onClick={switchToVisual}>
            可视化
          </ModeButton>
          <ModeButton
            active={!showVisual}
            onClick={() => {
              setSwitchError(null);
              setMode('raw');
            }}
          >
            <Braces className="size-3" /> JSON
          </ModeButton>
        </div>
      </div>

      {showVisual ? (
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-input p-3">
          {parsed.status === 'blank' ? (
            <BlankState onPick={(type) => emit(defaultValueFor(type))} />
          ) : parsed.status === 'ok' ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {JSON_TYPE_LABELS[jsonTypeOf(parsed.data)]}
                </span>
                <NodeMenu
                  root={parsed.data}
                  path={[]}
                  onChange={emit}
                  onDeleteRoot={() => onChange('')}
                />
              </div>
              <JsonNodeEditor root={parsed.data} path={[]} onChange={emit} />
            </>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={value}
            rows={12}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder='{"visible": true}'
            aria-invalid={parsed.status === 'error'}
            onChange={(changeEvent) => {
              setSwitchError(null);
              onChange(changeEvent.target.value);
            }}
          />
          <div className="flex items-start justify-between gap-2">
            <FieldError
              message={
                switchError ?? (parsed.status === 'error' ? parsed.message : null)
              }
            />
            {parsed.status === 'ok' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => emit(parsed.data)}
              >
                格式化
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={combineClassNames(
        'inline-flex h-6 items-center gap-1 rounded px-2 text-xs transition-colors',
        active
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function BlankState({ onPick }: { onPick: (type: JsonType) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <p className="text-sm text-muted-foreground">创建 JSON 数据,先选根节点类型</p>
      <div className="grid grid-cols-2 gap-2">
        {ROOT_TYPE_CHOICES.map((choice) => (
          <Button
            key={choice.type}
            type="button"
            variant="outline"
            className="h-9 w-32 justify-start"
            onClick={() => onPick(choice.type)}
          >
            {choice.icon} {JSON_TYPE_LABELS[choice.type]}
          </Button>
        ))}
      </div>
    </div>
  );
}
