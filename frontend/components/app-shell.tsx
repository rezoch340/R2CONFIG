'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Blocks,
  Boxes,
  ScrollText,
  LayoutDashboard,
  LogOut,
  KeySquare,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  SlidersHorizontal,
  UserRound,
  Users,
} from 'lucide-react';
import { AccountPasswordDialog } from '@/components/account-password-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuthentication } from '@/lib/auth';
import { ENVIRONMENT_DOT_CLASS, environmentTone } from '@/lib/environment-tone';
import { useActiveConfig } from '@/lib/config-context';
import { combineClassNames } from '@/lib/utils';

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: {
    action: string;
    subject: string;
  };
}

const NAVIGATION_GROUPS: Array<{
  label: string;
  items: NavigationItem[];
}> = [
  {
    label: '工作台',
    items: [
      {
        href: '/params',
        label: '参数',
        icon: SlidersHorizontal,
        permission: { action: 'read', subject: 'config' },
      },
      {
        href: '/apps',
        label: '应用',
        icon: Boxes,
        permission: { action: 'read', subject: 'config' },
      },
    ],
  },
  {
    label: '访问控制',
    items: [
      {
        href: '/users',
        label: '后台账号',
        icon: Users,
        permission: { action: 'read', subject: 'user' },
      },
      {
        href: '/permission-groups',
        label: '权限组',
        icon: ShieldCheck,
        permission: { action: 'read', subject: 'rbac' },
      },
    ],
  },
  {
    label: '审计',
    items: [
      {
        href: '/system-logs',
        label: '系统日志',
        icon: ScrollText,
        permission: { action: 'read', subject: 'system-log' },
      },
    ],
  },
];

function Brand() {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
      <span className="relative flex size-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
        <Blocks className="size-5" />
        <span className="signal-pulse absolute -right-0.5 -top-0.5 size-2 rounded-full bg-cyan-300" />
      </span>
      <div>
        <p className="font-heading text-sm font-semibold tracking-[0.16em] text-white">
          R2CONFIG
        </p>
        <p className="font-mono text-[9px] tracking-[0.18em] text-sidebar-foreground uppercase">
          Config Console
        </p>
      </div>
    </div>
  );
}

function Navigation({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { can } = useAuthentication();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
      {NAVIGATION_GROUPS.map((navigationGroup) => {
        const visibleItems = navigationGroup.items.filter(
          (navigationItem) =>
            !navigationItem.permission ||
            can(
              navigationItem.permission.action,
              navigationItem.permission.subject,
            ),
        );
        if (visibleItems.length === 0) {
          return null;
        }
        return (
          <section key={navigationGroup.label} className="space-y-1">
            <p className="px-3 pb-1 font-mono text-[9px] font-semibold tracking-[0.18em] text-sidebar-foreground/55 uppercase">
              {navigationGroup.label}
            </p>
            {visibleItems.map((navigationItem) => {
              const isActive =
                navigationItem.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(navigationItem.href);
              const NavigationIcon = navigationItem.icon;
              return (
                <Link
                  key={navigationItem.href}
                  href={navigationItem.href}
                  prefetch
                  onNavigate={() => onNavigate?.()}
                  className={combineClassNames(
                    // 悬停时整项右移一点点,配合颜色过渡,点击有去处的感觉
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                  )}
                >
                  <NavigationIcon
                    className={combineClassNames(
                      'size-4',
                    )}
                  />
                  {navigationItem.label}
                </Link>
              );
            })}
          </section>
        );
      })}
    </nav>
  );
}

// 顶栏「当前应用 / 当前环境」只服务参数页,别的页面不显示
function ActiveConfigSwitcher() {
  const pathname = usePathname();
  const { can } = useAuthentication();
  const {
    apps,
    environments,
    activeApp,
    activeEnvironment,
    selectApp,
    selectEnvironment,
  } = useActiveConfig();
  if (!pathname.startsWith('/params') || !can('read', 'config')) {
    return <div />;
  }
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-6">
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase md:inline">
          当前应用
        </span>
        <Select
          value={activeApp ? String(activeApp.id) : ''}
          // items 让触发器显示名称而不是 id
          items={apps.map((app) => ({ value: String(app.id), label: app.name }))}
          onValueChange={(value) => value && selectApp(Number(value))}
        >
          <SelectTrigger size="sm" className="min-w-32" aria-label="当前应用">
            <SelectValue placeholder={apps.length ? '选择应用' : '暂无应用'} />
          </SelectTrigger>
          <SelectContent>
            {apps.map((app) => (
              <SelectItem key={app.id} value={String(app.id)}>
                {app.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase md:inline">
          当前环境
        </span>
        <Select
          value={activeEnvironment ? String(activeEnvironment.id) : ''}
          items={environments.map((environment) => ({
            value: String(environment.id),
            label: environment.name,
          }))}
          onValueChange={(value) => value && selectEnvironment(Number(value))}
        >
          <SelectTrigger
            size="sm"
            className="min-w-24 font-mono"
            aria-label="当前环境"
          >
            {activeEnvironment && (
              <EnvironmentDot name={activeEnvironment.name} />
            )}
            <SelectValue placeholder="环境" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((environment) => (
              <SelectItem
                key={environment.id}
                value={String(environment.id)}
                className="font-mono"
              >
                <EnvironmentDot name={environment.name} />
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '切换到浅色' : '切换到深色'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const { user, logout, isRoot, can } = useAuthentication();
  const pathname = usePathname();
  return (
    <div className="grid h-svh overflow-hidden lg:grid-cols-[230px_1fr]">
      <aside className="hidden flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <Brand />
        <Navigation />
      </aside>

      <Sheet
        open={isMobileNavigationOpen}
        onOpenChange={setIsMobileNavigationOpen}
      >
        <SheetContent
          side="left"
          showCloseButton
          className="gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">主导航</SheetTitle>
          <SheetDescription className="sr-only">
            R2CONFIG 控制台页面导航
          </SheetDescription>
          <Brand />
          <Navigation onNavigate={() => setIsMobileNavigationOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/85 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="打开导航"
            onClick={() => setIsMobileNavigationOpen(true)}
          >
            <Menu />
          </Button>
          <ActiveConfigSwitcher />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-9 gap-2 px-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-3.5" />
                  </span>
                  <span className="font-mono text-xs">{user?.username}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuItem disabled>
                {isRoot ? '种子管理员' : '后台账号'}
              </DropdownMenuItem>
              {can('update', 'user') ? (
                <DropdownMenuItem
                  onClick={() => setIsPasswordDialogOpen(true)}
                >
                  <KeySquare />
                  修改我的密码
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {/* key 绑路由:路径一变就重挂,入场动画随之重放。
              motion-safe 让开启「减少动态效果」的系统直接跳过 */}
          <div
            key={pathname}
            className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:ease-out"
          >
            {children}
          </div>
        </main>
      </div>
      <AccountPasswordDialog
        key={`account-password-${isPasswordDialogOpen}`}
        open={isPasswordDialogOpen}
        userId={user?.id}
        onClose={() => setIsPasswordDialogOpen(false)}
      />
    </div>
  );
}

// 生产红、开发绿,一眼看出自己在改哪个环境
function EnvironmentDot({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className={combineClassNames(
        'mr-1.5 inline-block size-1.5 shrink-0 rounded-full',
        ENVIRONMENT_DOT_CLASS[environmentTone(name)],
      )}
    />
  );
}
