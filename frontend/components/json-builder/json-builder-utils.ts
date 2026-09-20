// JSON 可视化编辑器的纯函数部分:类型、按 path 改值、类型默认值、展示推断。
// 所有操作都返回新对象,不改入参。

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type JsonType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

// path 里字符串是对象 key,数字是数组下标
export type JsonPath = Array<string | number>;

export const JSON_TYPES: JsonType[] = [
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
];

export const JSON_TYPE_LABELS: Record<JsonType, string> = {
  string: 'String',
  number: 'Number',
  boolean: 'Boolean',
  object: 'Object',
  array: 'Array',
  null: 'Null',
};

export function jsonTypeOf(value: JsonValue): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value as 'string' | 'number' | 'boolean';
}

export function defaultValueFor(type: JsonType): JsonValue {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    case 'null':
      return null;
  }
}

// 有子节点的对象/数组换类型或删除时才需要二次确认
export function hasChildren(value: JsonValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return false;
}

function childOf(container: JsonValue, segment: string | number): JsonValue {
  if (Array.isArray(container)) return container[segment as number];
  if (container !== null && typeof container === 'object') {
    return container[segment as string];
  }
  throw new Error(`路径 ${String(segment)} 上不是对象或数组`);
}

// 用 updater 改 path 指向的位置,沿途拷贝。path 为空就是改根
function updateAtPath(
  root: JsonValue,
  path: JsonPath,
  updater: (current: JsonValue) => JsonValue,
): JsonValue {
  if (path.length === 0) return updater(root);
  const [segment, ...rest] = path;
  const child = childOf(root, segment);
  const nextChild = updateAtPath(child, rest, updater);
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[segment as number] = nextChild;
    return copy;
  }
  return { ...(root as JsonObject), [segment as string]: nextChild };
}

export function getValueAtPath(root: JsonValue, path: JsonPath): JsonValue {
  let current = root;
  for (const segment of path) current = childOf(current, segment);
  return current;
}

export function setValueAtPath(
  root: JsonValue,
  path: JsonPath,
  value: JsonValue,
): JsonValue {
  return updateAtPath(root, path, () => value);
}

export function removeValueAtPath(root: JsonValue, path: JsonPath): JsonValue {
  if (path.length === 0) throw new Error('不能删除根节点');
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  return updateAtPath(root, parentPath, (parent) => {
    if (Array.isArray(parent)) {
      return parent.filter((_item, index) => index !== last);
    }
    const copy = { ...(parent as JsonObject) };
    delete copy[last as string];
    return copy;
  });
}

// 改 key 时保持字段顺序不变
export function renameObjectKey(
  root: JsonValue,
  objectPath: JsonPath,
  oldKey: string,
  newKey: string,
): JsonValue {
  if (oldKey === newKey) return root;
  return updateAtPath(root, objectPath, (target) => {
    const source = target as JsonObject;
    if (newKey in source) throw new Error(`字段 ${newKey} 已存在`);
    const renamed: JsonObject = {};
    for (const [key, value] of Object.entries(source)) {
      renamed[key === oldKey ? newKey : key] = value;
    }
    return renamed;
  });
}

export function insertArrayItem(
  root: JsonValue,
  arrayPath: JsonPath,
  index: number,
  value: JsonValue,
): JsonValue {
  return updateAtPath(root, arrayPath, (target) => {
    const copy = [...(target as JsonValue[])];
    copy.splice(index, 0, value);
    return copy;
  });
}

export function addObjectField(
  root: JsonValue,
  objectPath: JsonPath,
  key: string,
  value: JsonValue,
): JsonValue {
  return updateAtPath(root, objectPath, (target) => ({
    ...(target as JsonObject),
    [key]: value,
  }));
}

// 展示形式只影响编辑器长相,不进 JSON
export type Presentation = 'text' | 'url' | 'image-url';

const IMAGE_KEY_PATTERN = /(icon|image|avatar|logo|thumbnail|cover)/i;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|svg|ico|bmp|avif)(\?|#|$)/i;

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

export function inferPresentation(key: string | number, value: string): Presentation {
  if (!isHttpUrl(value)) return 'text';
  if (IMAGE_EXTENSION_PATTERN.test(value)) return 'image-url';
  if (typeof key === 'string' && IMAGE_KEY_PATTERN.test(key)) return 'image-url';
  return 'url';
}

// 把 JSON.parse 的报错翻成「第几行第几列」;V8 的信息里带 position
export function describeJsonError(source: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = /position (\d+)/.exec(message);
  if (!positionMatch) return `JSON 格式错误:${message}`;
  const position = Number(positionMatch[1]);
  const before = source.slice(0, position);
  const line = before.split('\n').length;
  const column = position - before.lastIndexOf('\n');
  const detail = message.replace(/\s*in JSON at position.*$/i, '');
  return `JSON 格式错误:第 ${line} 行,第 ${column} 列 · ${detail}`;
}
