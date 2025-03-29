'use client'

import { Button } from '@/components/ui/button'
import { ThemeProvider } from '@/components/theme-provider'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h2 className="text-xl font-semibold mb-4">App Error</h2>
            <p className="text-muted-foreground mb-6">
              Something went wrong with the application.
            </p>
            <Button onClick={() => reset()}>Try again</Button>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
