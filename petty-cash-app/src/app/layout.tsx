import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Nabeel — Cash Manager', description: 'Petty cash tracking app' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
