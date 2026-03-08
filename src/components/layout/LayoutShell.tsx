'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import ChatRail from '@/components/layout/ChatRail';

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The landing page handles its own full-screen layout
  if (pathname === '/') {
    return <>{children}</>;
  }

  return (
    <>
      <TopBar />
      <Sidebar />
      <main className="pt-14 lg:pl-56 min-h-screen pb-20 lg:pb-0">
        <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
      <ChatRail />
    </>
  );
}
