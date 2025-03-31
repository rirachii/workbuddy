import type { Metadata } from 'next'

const metadata: Metadata = {
  title: 'Ghosted AI',
  description: 'Your AI companion for navigating the tough job market',
  openGraph: {
    title: 'Ghosted AI',
    description: 'Your AI companion for navigating the tough job market',
    images: ['/ghostai.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ghosted AI',
    description: 'Your AI companion for navigating the tough job market',
    images: ['/ghostai.png'],
  },
  icons: {
    icon: '/ghostai.png',
    apple: '/ghostai.png',
  },
}

export default metadata 