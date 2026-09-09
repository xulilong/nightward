import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://nightward-mistwood.alexander-morg562775.chatgpt.site'),
  title: '逐夜之刃 · 雾林驿道',
  description: '握紧你的剑，为归途点亮下一盏灯。横屏俯视角动作闯关试玩。',
  icons: { icon: '/favicon.svg' },
  openGraph: { title: '逐夜之刃 · 雾林驿道', description: '循灯而行，挥剑逐夜。横屏动作闯关试玩。', type: 'website', locale: 'zh_CN', images: [{ url: '/og.png', width: 1672, height: 941, alt: '逐夜之刃：巡灯人踏上雾林驿道' }] },
  twitter: { card: 'summary_large_image', title: '逐夜之刃 · 雾林驿道', description: '循灯而行，挥剑逐夜。横屏动作闯关试玩。', images: ['/og.png'] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
