import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TorqueTools ERP | Sistema de Gestión Integral',
  description: 'ERP/CRM para gestión de herramientas industriales - TorqueTools Group',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-[#0B0E13] text-[#F0F2F5] antialiased">
        {children}
      </body>
    </html>
  )
}
