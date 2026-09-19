import { redirect } from 'next/navigation';

// 首页就是参数页
export default function HomePage() {
  redirect('/params');
}
