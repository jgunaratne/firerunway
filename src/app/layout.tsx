import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from 'next/font/google';
import "./globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

import { UploadProvider } from "@/components/upload/UploadProvider";
import UploadNotification from "@/components/upload/UploadNotification";
import LayoutShell from '@/components/layout/LayoutShell';

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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Blocking script: set data-theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('firerunway-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.setAttribute('data-theme','dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark')}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ThemeProvider>
            <UserDataProvider>
              <BrokerageWrapper>
                <PageContextProvider>
                  <LayoutShell>
                    <UploadProvider>
                      <UploadNotification />
                      {children}
                    </UploadProvider>
                  </LayoutShell>
                </PageContextProvider>
              </BrokerageWrapper>
            </UserDataProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
