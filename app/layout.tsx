import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/providers/supabase-auth-provider"
import { PostHogProvider } from "@/components/providers/PostHogProvider"
import metadata from './metadata'
import { SupabaseProvider } from '@/components/providers/supabase-provider'
import { SubscriptionProvider } from '@/components/providers/subscription-provider'

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Voice Memo App',
  description: 'Record and transcribe voice memos with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SupabaseProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SupabaseProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  {children}
                  <Toaster />
                </SubscriptionProvider>
              </AuthProvider>
            </SupabaseProvider>
          </ThemeProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
