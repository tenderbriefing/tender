'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!deferred || dismissed) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt()
        setDismissed(true)
        setDeferred(null)
      }}
      className="mt-2 flex w-full min-h-[40px] items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-800"
    >
      <Download className="h-4 w-4" />
      Install field app
    </button>
  )
}
