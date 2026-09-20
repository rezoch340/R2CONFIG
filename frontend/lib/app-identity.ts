// 应用的「脸」:首字母 + 按 slug 哈希的底色,应用页卡片和顶栏切换器共用

// 只留白字在浅底上也够对比的深色;amber / sky 这类浅色不要,灰色更不要——灰是「已停用」专用
const APP_TILE_CLASSES = [
  'bg-indigo-500 text-white',
  'bg-orange-500 text-white',
  'bg-emerald-500 text-white',
  'bg-violet-500 text-white',
  'bg-rose-500 text-white',
  'bg-blue-600 text-white',
  'bg-teal-600 text-white',
  'bg-fuchsia-600 text-white',
];

export const DISABLED_TILE_CLASS = 'border bg-muted text-muted-foreground';

// 名字以字母开头就取前两个字母(OA审批 → OA),否则取第一个字
export function appInitials(name: string): string {
  const latin = /^[A-Za-z]{2}/.exec(name);
  return latin ? latin[0].toUpperCase() : name.slice(0, 1).toUpperCase();
}

export function appTileClass(slug: string, enabled = true): string {
  if (!enabled) return DISABLED_TILE_CLASS;
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return APP_TILE_CLASSES[Math.abs(hash) % APP_TILE_CLASSES.length];
}
