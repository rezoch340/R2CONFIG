import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';
import { readRuntimeConfiguration } from '@/lib/runtime-config';
import './globals.css';

// 字体照 Nona DESIGN.md:Space Grotesk 标题 / Inter 正文 / JetBrains Mono 代码
const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontHeading = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
});
const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Remote Config',
  description: '应用动态配置下发后台',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtimeConfiguration = JSON.stringify(
    readRuntimeConfiguration(),
  ).replace(/</g, '\\u003c');
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`h-full antialiased ${fontSans.variable} ${fontHeading.variable} ${fontMono.variable}`}
    >
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ADMIN_BASE_CONFIG__=${runtimeConfiguration};`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
