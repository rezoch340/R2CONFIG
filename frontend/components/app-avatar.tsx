import { appInitials, appTileClass } from '@/lib/app-identity';
import { combineClassNames } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'size-6 rounded-md text-[11px]',
  md: 'size-7 rounded-md text-xs',
  lg: 'size-11 rounded-xl text-lg',
} as const;

// 应用的头像:同一个应用在顶栏、应用页、参数页永远是同一个缩写和颜色;停用变灰
export function AppAvatar({
  name,
  slug,
  enabled = true,
  size = 'md',
  className,
}: {
  name: string;
  slug: string;
  enabled?: boolean;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={combineClassNames(
        'flex shrink-0 items-center justify-center font-heading font-semibold',
        SIZE_CLASSES[size],
        appTileClass(slug, enabled),
        className,
      )}
    >
      {appInitials(name)}
    </span>
  );
}
