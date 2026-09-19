import { BadRequestException } from '@nestjs/common';
import {
  coerceParamValue,
  computeConfigEtag,
  inferParam,
  normalizeParamValue,
  PARAM_KEY_PATTERN,
} from './param-value';

describe('参数 key 校验', () => {
  it.each([
    'App:Announcement',
    'Features:BiometricLogin',
    'timeout',
    'a.b-c_d:x',
  ])('接受 %s', (key) => expect(PARAM_KEY_PATTERN.test(key)).toBe(true));
  it.each(['', ':x', 'x:', 'a b', 'a::b', 'a/b', '中文'])('拒绝 %j', (key) =>
    expect(PARAM_KEY_PATTERN.test(key)).toBe(false),
  );
});

describe('参数值规整', () => {
  it('boolean 只认 true/false 且忽略大小写空白', () => {
    expect(normalizeParamValue('boolean', ' TRUE ')).toBe('true');
    expect(() => normalizeParamValue('boolean', 'yes')).toThrow(
      BadRequestException,
    );
  });
  it('json 必须合法并压缩存储', () => {
    expect(normalizeParamValue('json', '{ "a" : 1 }')).toBe('{"a":1}');
    expect(() => normalizeParamValue('json', '{a:1}')).toThrow(
      BadRequestException,
    );
  });
  it('text 原样保留', () => {
    expect(normalizeParamValue('text', ' 3.0.0 ')).toBe(' 3.0.0 ');
  });
});

describe('参数值下发转换', () => {
  it('按类型转真值', () => {
    expect(coerceParamValue('boolean', 'true')).toBe(true);
    expect(coerceParamValue('json', '{"a":[1]}')).toEqual({ a: [1] });
    expect(coerceParamValue('text', 'carousel')).toBe('carousel');
  });
});

describe('批量导入类型推断', () => {
  it('按 JS 类型推断', () => {
    expect(inferParam(true)).toEqual({ type: 'boolean', value: 'true' });
    expect(inferParam({ a: 1 })).toEqual({ type: 'json', value: '{"a":1}' });
    expect(inferParam([1])).toEqual({ type: 'json', value: '[1]' });
    expect(inferParam(42)).toEqual({ type: 'text', value: '42' });
    expect(inferParam('x')).toEqual({ type: 'text', value: 'x' });
  });
});

describe('ETag', () => {
  it('数量或时间变化即变化,且为弱 ETag', () => {
    const stampedAt = new Date('2026-09-20T00:00:00Z');
    const base = computeConfigEtag(2, stampedAt);
    expect(base).toMatch(/^W\/"[0-9a-f]{40}"$/);
    expect(computeConfigEtag(2, stampedAt)).toBe(base);
    expect(computeConfigEtag(3, stampedAt)).not.toBe(base);
    expect(computeConfigEtag(2, new Date(stampedAt.getTime() + 1))).not.toBe(
      base,
    );
    expect(computeConfigEtag(0, null)).toMatch(/^W\/"/);
  });
});
