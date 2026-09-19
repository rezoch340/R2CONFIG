'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuthentication } from '@/lib/auth';
import { ActiveConfigProvider } from '@/lib/config-context';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuthentication();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [router, user]);

  if (!user) {
    return null;
  }
  return (
    <ActiveConfigProvider>
      <AppShell>{children}</AppShell>
    </ActiveConfigProvider>
  );
}
