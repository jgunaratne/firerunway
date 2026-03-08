import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import ChatRail from "@/components/layout/ChatRail";
import { UploadProvider } from "@/components/upload/UploadProvider";
import UploadNotification from "@/components/upload/UploadNotification";

export const metadata: Metadata = {
  title: "FireRunway — Financial Independence Dashboard",
  description: "Know if you're financially independent — before you find out the hard way.",
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
};

export const dynamic = 'force-dynamic';
import { UserDataProvider } from "@/lib/UserDataContext";
import { PageContextProvider } from "@/lib/PageContextProvider";
import BrokerageWrapper from "@/components/layout/BrokerageWrapper";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { AuthProvider } from "@/lib/AuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script: set data-theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('firerunway-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else if(window.matchMedia('(prefers-color-scheme:light)').matches){document.documentElement.setAttribute('data-theme','light')}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ThemeProvider>
            <UserDataProvider>
              <BrokerageWrapper>
                <PageContextProvider>
                  <UploadProvider>
                    <TopBar />
                    <Sidebar />
                    <main className="pt-14 lg:pl-56 min-h-screen pb-20 lg:pb-0">
                      <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
                        {children}
                      </div>
                    </main>
                    <UploadNotification />
                    <ChatRail />
                  </UploadProvider>
                </PageContextProvider>
              </BrokerageWrapper>
            </UserDataProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
