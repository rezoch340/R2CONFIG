import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export const PARAM_TYPES = ['text', 'boolean', 'json'] as const;
export const PARAM_SCOPES = ['public', 'private'] as const;
export const PARAM_KEY_PATTERN = /^[A-Za-z0-9_.-]+(:[A-Za-z0-9_.-]+)*$/;

export type ParamType = (typeof PARAM_TYPES)[number];
export type ParamScope = (typeof PARAM_SCOPES)[number];

// 写入前把原文按类型规整:boolean 只认 true/false,json 必须能 parse
export function normalizeParamValue(type: ParamType, value: string): string {
  if (type === 'boolean') {
    const lowered = value.trim().toLowerCase();
    if (lowered !== 'true' && lowered !== 'false') {
      throw new BadRequestException('boolean 类型的值只能是 true 或 false');
    }
    return lowered;
  }
  if (type === 'json') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      throw new BadRequestException('json 类型的值不是合法 JSON');
    }
  }
  return value;
}

// 下发时把原文转成真值
export function coerceParamValue(type: ParamType, value: string): unknown {
  if (type === 'boolean') {
    return value === 'true';
  }
  if (type === 'json') {
    return JSON.parse(value) as unknown;
  }
  return value;
}

// 批量导入按 JS 类型推断:boolean → boolean,对象/数组 → json,其余 text
export function inferParam(value: unknown): { type: ParamType; value: string } {
  if (typeof value === 'boolean') {
    return { type: 'boolean', value: String(value) };
  }
  if (value !== null && typeof value === 'object') {
    return { type: 'json', value: JSON.stringify(value) };
  }
  return { type: 'text', value: String(value) };
}

// 弱 ETag:数量 + 最后修改时间,任一变化即失效
export function computeConfigEtag(count: number, latest: Date | null): string {
  const digest = createHash('sha1')
    .update(`${count}:${latest?.toISOString() ?? ''}`)
    .digest('hex');
  return `W/"${digest}"`;
}
