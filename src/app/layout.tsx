import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "FireRunway — Financial Independence Dashboard",
  description: "Know if you're financially independent — before you find out the hard way.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TopBar />
        <Sidebar />
        <main className="pt-14 lg:pl-56 min-h-screen pb-20 lg:pb-0">
          <div className="max-w-[1400px] mx-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
