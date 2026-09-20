// 跑法:node --test --experimental-strip-types test/json-builder-utils.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addObjectField,
  describeJsonError,
  hasChildren,
  inferPresentation,
  insertArrayItem,
  removeValueAtPath,
  renameObjectKey,
  setValueAtPath,
} from '../components/json-builder/json-builder-utils.ts';

const firstItem = { name: 'a', on: true };
const root = { list: [firstItem, 2], meta: { count: 1 } };

test('setValueAtPath 只换路径上的节点,其余引用不变', () => {
  const next = setValueAtPath(root, ['list', 0, 'name'], 'b') as typeof root;
  assert.deepEqual(next.list[0], { name: 'b', on: true });
  assert.equal(next.meta, root.meta);
  assert.equal(firstItem.name, 'a');
});

test('removeValueAtPath 对象删 key、数组删下标', () => {
  assert.deepEqual(removeValueAtPath(root, ['meta', 'count']), {
    ...root,
    meta: {},
  });
  const next = removeValueAtPath(root, ['list', 0]) as typeof root;
  assert.deepEqual(next.list, [2]);
});

test('renameObjectKey 保持顺序,重名抛错', () => {
  const renamed = renameObjectKey(root, ['list', 0], 'name', 'title') as typeof root;
  assert.deepEqual(Object.keys(renamed.list[0]), ['title', 'on']);
  assert.throws(() => renameObjectKey(root, ['list', 0], 'name', 'on'));
});

test('insertArrayItem / addObjectField', () => {
  const withItem = insertArrayItem(root, ['list'], 1, null) as typeof root;
  assert.deepEqual(withItem.list, [{ name: 'a', on: true }, null, 2]);
  const withField = addObjectField(root, [], 'flag', false) as Record<string, unknown>;
  assert.equal(withField.flag, false);
});

test('hasChildren 只对非空容器为真', () => {
  assert.equal(hasChildren({}), false);
  assert.equal(hasChildren([1]), true);
  assert.equal(hasChildren('x'), false);
});

test('inferPresentation 识别 url 和图片', () => {
  assert.equal(inferPresentation('name', 'hello'), 'text');
  assert.equal(inferPresentation('downloadUrl', 'https://x.io/a.apk'), 'url');
  assert.equal(inferPresentation('icon', 'https://x.io/a'), 'image-url');
  assert.equal(inferPresentation('cover', 'https://x.io/a.png?v=1'), 'image-url');
});

test('describeJsonError 给出行列', () => {
  const source = '{\n  "a": 1\n  "b": 2\n}';
  let message = '';
  try {
    JSON.parse(source);
  } catch (error) {
    message = describeJsonError(source, error);
  }
  assert.match(message, /第 3 行,第 3 列/);
});
