import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Status Check',
  description: 'Відстеження дедлайнів та комітментів команди',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  )
}
