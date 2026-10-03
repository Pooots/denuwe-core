import type { RealtimeStatus } from '@/services/realtime'
import { cn } from '@/lib/utils'
import { useIsOnline, useRealtimeStatus } from '@/services/realtime'

const LABEL: Record<RealtimeStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected',
  unconfigured: 'Live updates off',
}

const DOT: Record<RealtimeStatus, string> = {
  connected: 'bg-success',
  connecting: 'bg-amber-500 animate-pulse',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-danger',
  unconfigured: 'bg-muted-foreground',
}

/** The live connection's state: Connected, Connecting..., Reconnecting... or Disconnected. */
export function ConnectionStatus({ className }: { className?: string }) {
  const status = useRealtimeStatus()
  return (
    <span
      role="status"
      aria-live="polite"
      title={status === 'disconnected' ? 'New messages will appear when the connection is back.' : undefined}
      className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground', className)}
    >
      <span className={cn('size-2 shrink-0 rounded-full', DOT[status])} />
      {LABEL[status]}
    </span>
  )
}

/** "Online" / "Offline" for the other person, or the connection state while you're not connected. */
export function PresenceLine({ userId, className }: { userId: number; className?: string }) {
  const status = useRealtimeStatus()
  const online = useIsOnline(userId)

  if (status === 'unconfigured') return null
  if (status !== 'connected') return <ConnectionStatus className={className} />
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        online ? 'text-success' : 'text-muted-foreground',
        className,
      )}
    >
      {online ? <span className="size-2 rounded-full bg-success" /> : null}
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
