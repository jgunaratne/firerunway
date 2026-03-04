import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import { UploadProvider } from "@/components/upload/UploadProvider";
import UploadNotification from "@/components/upload/UploadNotification";

export const metadata: Metadata = {
  title: "FireRunway — Financial Independence Dashboard",
  description: "Know if you're financially independent — before you find out the hard way.",
};

// Force dynamic rendering so pages aren't prerendered during build
// (Clerk requires publishableKey at render time)
export const dynamic = 'force-dynamic';
import { UserDataProvider, useUserData } from "@/lib/UserDataContext";
import { BrokerageDataProvider } from "@/lib/BrokerageDataContext";

function BrokerageWrapper({ children }: { children: React.ReactNode }) {
  'use client';
  const { clerkId } = useUserData();
  return <BrokerageDataProvider clerkId={clerkId}>{children}</BrokerageDataProvider>;
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <UserDataProvider>
          <BrokerageWrapper>
            <UploadProvider>
              <TopBar />
              <Sidebar />
              <main className="pt-14 lg:pl-56 min-h-screen pb-20 lg:pb-0">
                <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
                  {children}
                </div>
              </main>
              <UploadNotification />
            </UploadProvider>
          </BrokerageWrapper>
        </UserDataProvider>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If Clerk is not configured, render without auth (dev/demo mode)
  if (!clerkKey) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#6366f1',
          colorBackground: '#111118',
          colorInputBackground: '#1a1a24',
          colorText: '#f0f0ff',
        },
      }}
    >
      <AppShell>{children}</AppShell>
    </ClerkProvider>
  );
}
