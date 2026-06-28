import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitchdeck Assistant",
  description: "AI-powered pitch deck analysis for investors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
