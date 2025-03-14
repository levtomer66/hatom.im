import './globals.css';
import { Rubik } from 'next/font/google';

const rubik = Rubik({ 
  subsets: ['latin', 'hebrew'],
  display: 'swap',
});

export const metadata = {
  title: 'יום הולדת לתומיתילו',
  description: 'יום הולדת לתומיתילו',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={rubik.className}>
        {children}
      </body>
    </html>
  )
}
