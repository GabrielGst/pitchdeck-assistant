import { ClerkProvider, SignedIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "VC Pipeline",
  description: "AI-powered pitch deck analysis for investors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
          <SignedIn>
            <Navbar />
          </SignedIn>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
