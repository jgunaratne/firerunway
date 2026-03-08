'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import ChatRail from '@/components/layout/ChatRail';

export default function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Standalone pages handle their own full-screen layout
  if (pathname === '/' || pathname === '/contact' || pathname === '/privacy') {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-bg-primary text-text-primary font-sans flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative pb-20 lg:pb-0">
          {/* Grid Background */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
          <div className="relative z-10 p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <ChatRail />
    </div>
  );
}
