import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Stride — Running Load Agent',
  description:
    'An agent that turns your Runna/Strava runs into a training log and flags when to cut back or ramp up on pace and mileage.',
  generator: 'v0.app',
  applicationName: 'Stride Log',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.webp', sizes: '192x192', type: 'image/webp' },
      { url: '/icons/icon-512.webp', sizes: '512x512', type: 'image/webp' },
      { url: '/app-icon.png', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [{ url: '/app-icon.png', sizes: '1024x1024', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Stride Log',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#211f26',
  // Draw under the iOS notch / home indicator so we can apply our own
  // safe-area insets and get an edge-to-edge, native-feeling layout.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="bg-background font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
