import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SessionProvider } from '@/components/session-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { NotificationProvider } from '@/lib/notification-context'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Grow Medico – Healthcare Digital Marketing Agency',
  description: 'Grow Medico – Employee Resource Management for Grow Medico, Healthcare Digital Marketing Agency',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/gm-fav-icon.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/gm-fav-icon.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/gm-fav-icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/gm-fav-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="gm-theme"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </SessionProvider>
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
