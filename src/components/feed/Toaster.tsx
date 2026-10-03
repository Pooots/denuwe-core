import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

type ToastItem = { id: number; message: string; tone: 'default' | 'error' }

let items: Array<ToastItem> = []
let nextId = 1
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function toast(message: string, tone: ToastItem['tone'] = 'default'): void {
  const id = nextId++
  items = [...items, { id, message, tone }]
  emit()
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id)
    emit()
  }, 3200)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribe, () => items)

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 md:bottom-16 z-[70] flex flex-col gap-2" aria-live="polite">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={cn(
            'rounded-lg px-4 py-3 text-[13px] font-semibold text-white shadow-lg',
            item.tone === 'error' ? 'bg-danger' : 'bg-ink',
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}
