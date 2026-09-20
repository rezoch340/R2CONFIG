// 生产环境要显眼一点;名字随便叫,按常见写法猜
export type EnvironmentTone = 'production' | 'development' | 'staging' | 'other';

export function environmentTone(name: string): EnvironmentTone {
  const lower = name.toLowerCase();
  if (/^(prod|production|live|release)/.test(lower)) return 'production';
  if (/^(dev|development|local)/.test(lower)) return 'development';
  if (/^(stag|test|uat|qa|preview|beta|canary)/.test(lower)) return 'staging';
  return 'other';
}

// 颜色只表状态:线上绿、预发黄、开发和其他中性
export const ENVIRONMENT_DOT_CLASS: Record<EnvironmentTone, string> = {
  production: 'bg-emerald-500',
  staging: 'bg-amber-500',
  development: 'bg-slate-400',
  other: 'bg-slate-400',
};
