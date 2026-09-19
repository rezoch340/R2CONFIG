'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestApi } from '@/lib/api-client';
import { useAuthentication } from '@/lib/auth';
import type { ConfigApp, ConfigEnvironment } from '@/lib/models';

// 顶栏「当前应用 / 当前环境」的全局上下文,选中值落 localStorage
const ACTIVE_APP_KEY = 'rc.activeAppId';
const ACTIVE_ENV_KEY = 'rc.activeEnvId';

function readStoredId(storageKey: string): number | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(storageKey);
  const parsed = stored ? Number(stored) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

function writeStoredId(storageKey: string, value: number | null) {
  if (typeof window === 'undefined') return;
  if (value === null) window.localStorage.removeItem(storageKey);
  else window.localStorage.setItem(storageKey, String(value));
}

interface ActiveConfigContextValue {
  apps: ConfigApp[];
  environments: ConfigEnvironment[];
  isLoading: boolean;
  activeApp: ConfigApp | null;
  activeEnvironment: ConfigEnvironment | null;
  selectApp: (appId: number) => void;
  selectEnvironment: (environmentId: number) => void;
}

const ActiveConfigContext = createContext<ActiveConfigContextValue | null>(
  null,
);

export function ActiveConfigProvider({ children }: { children: ReactNode }) {
  const { can } = useAuthentication();
  const canRead = can('read', 'config');
  // 只在客户端登录后渲染,lazy init 直接读 localStorage 不会有 hydration 差异
  const [activeAppId, setActiveAppId] = useState<number | null>(() =>
    readStoredId(ACTIVE_APP_KEY),
  );
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<
    number | null
  >(() => readStoredId(ACTIVE_ENV_KEY));

  const appsQuery = useQuery({
    queryKey: ['config-apps'],
    queryFn: () => requestApi<ConfigApp[]>('/config/apps'),
    enabled: canRead,
  });
  const apps = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);

  // 存的 id 已被删除或首次进入 → 退到第一个应用
  const activeApp =
    apps.find((app) => app.id === activeAppId) ?? apps[0] ?? null;

  const environments = useMemo(
    () => activeApp?.environments ?? [],
    [activeApp],
  );

  // 环境同理退级,默认优先 prod
  const activeEnvironment =
    environments.find(
      (environment) => environment.id === activeEnvironmentId,
    ) ??
    environments.find((environment) => environment.name === 'prod') ??
    environments[0] ??
    null;

  const selectApp = useCallback((appId: number) => {
    setActiveAppId(appId);
    setActiveEnvironmentId(null);
    writeStoredId(ACTIVE_APP_KEY, appId);
    writeStoredId(ACTIVE_ENV_KEY, null);
  }, []);

  const selectEnvironment = useCallback((environmentId: number) => {
    setActiveEnvironmentId(environmentId);
    writeStoredId(ACTIVE_ENV_KEY, environmentId);
  }, []);

  const value = useMemo<ActiveConfigContextValue>(
    () => ({
      apps,
      environments,
      isLoading: appsQuery.isLoading,
      activeApp,
      activeEnvironment,
      selectApp,
      selectEnvironment,
    }),
    [
      apps,
      environments,
      appsQuery.isLoading,
      activeApp,
      activeEnvironment,
      selectApp,
      selectEnvironment,
    ],
  );

  return (
    <ActiveConfigContext.Provider value={value}>
      {children}
    </ActiveConfigContext.Provider>
  );
}

export function useActiveConfig(): ActiveConfigContextValue {
  const context = useContext(ActiveConfigContext);
  if (!context) {
    throw new Error('useActiveConfig 必须在 ActiveConfigProvider 内使用');
  }
  return context;
}
