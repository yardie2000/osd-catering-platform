import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { QueryProvider } from '@/providers/query-provider'
import { AppLayout } from '@/components/layout/app-layout'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'OSD Catering Platform V5.3.0',
    template: '%s · OSD Catering Platform',
  },
  description: 'OSD Catering Operations Platform V5.3.0 - Menu, Recipe, Purchasing & Production',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <body>
        <QueryProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'bg-card border-border text-foreground shadow-xl',
                title: 'text-foreground font-medium',
                description: 'text-muted-foreground',
                success: 'border-l-4 border-l-amber-400',
                error: 'border-l-4 border-l-destructive',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  )
}
