import { version as reactVersion } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CheckCircle2,
  Database,
  Globe,
  LoaderCircle,
  MonitorSmartphone,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/brand/Brand'
import { API_BASE_URL, API_ROOT_URL } from '@/lib/api'
import { systemService } from '@/services/systemService'

type State = 'ok' | 'error' | 'loading'

const REFETCH_MS = 15_000

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Request failed'
}

function StateIcon({ state, className }: { state: State; className?: string }) {
  if (state === 'loading') {
    return <LoaderCircle className={cn('size-4 animate-spin text-muted-foreground', className)} />
  }
  if (state === 'ok') {
    return <CheckCircle2 className={cn('size-4 text-success', className)} />
  }
  return <XCircle className={cn('size-4 text-danger', className)} />
}

function StateBadge({ state, okLabel = 'Operational' }: { state: State; okLabel?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        state === 'ok' && 'bg-success/10 text-success',
        state === 'error' && 'bg-danger/10 text-danger',
        state === 'loading' && 'bg-secondary text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          state === 'ok' && 'bg-success',
          state === 'error' && 'bg-danger',
          state === 'loading' && 'animate-pulse bg-muted-foreground',
        )}
      />
      {state === 'ok' ? okLabel : state === 'error' ? 'Down' : 'Checking'}
    </span>
  )
}

function StatusCard({
  title,
  subtitle,
  icon,
  state,
  rows,
  footer,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  state: State
  rows: Array<[string, ReactNode]>
  footer?: ReactNode
}) {
  return (
    <section
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card/80 p-6 backdrop-blur transition-colors',
        state === 'ok' && 'border-success/25',
        state === 'error' && 'border-danger/40',
        state === 'loading' && 'border-border',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px',
          state === 'ok' && 'bg-gradient-to-r from-transparent via-success/60 to-transparent',
          state === 'error' && 'bg-gradient-to-r from-transparent via-danger/60 to-transparent',
        )}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl border border-border bg-secondary text-gold">
            {icon}
          </div>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <StateBadge state={state} />
      </div>

      <dl className="mt-6 space-y-2.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate text-right font-mono text-xs">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      {footer ? <div className="mt-5 border-t border-border pt-4 text-xs">{footer}</div> : null}
    </section>
  )
}

function FlowNode({ label, state, icon }: { label: string; state: State; icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'relative grid size-12 place-items-center rounded-full border bg-card',
          state === 'ok' && 'border-success/50 text-success',
          state === 'error' && 'border-danger/50 text-danger',
          state === 'loading' && 'border-border text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function FlowLink({ state }: { state: State }) {
  return (
    <div className="mb-6 h-0.5 min-w-6 flex-1 overflow-hidden rounded-full">
      <div className={cn('size-full', `status-link-${state}`)} />
    </div>
  )
}

export default function StatusPage() {
  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: systemService.health,
    refetchInterval: REFETCH_MS,
  })
  const apiRoot = useQuery({
    queryKey: ['system', 'api-root'],
    queryFn: systemService.apiRoot,
    refetchInterval: REFETCH_MS,
  })
  const apiV1 = useQuery({
    queryKey: ['system', 'api-v1'],
    queryFn: systemService.apiV1,
    refetchInterval: REFETCH_MS,
  })

  const frontendState: State = 'ok'
  const backendState: State = health.isPending ? 'loading' : health.isSuccess ? 'ok' : 'error'
  const databaseState: State = health.isPending
    ? 'loading'
    : health.data?.data.database.status === 'ok'
      ? 'ok'
      : 'error'

  const states = [frontendState, backendState, databaseState]
  const overall: State = states.includes('loading') ? 'loading' : states.every((s) => s === 'ok') ? 'ok' : 'error'

  const isFetching = health.isFetching || apiRoot.isFetching || apiV1.isFetching
  const refetchAll = () => {
    void health.refetch()
    void apiRoot.refetch()
    void apiV1.refetch()
  }

  const db = health.data?.data.database
  const lastChecked = health.dataUpdatedAt || health.errorUpdatedAt

  const endpoints = [
    { method: 'GET', path: '/api', url: API_ROOT_URL, query: apiRoot },
    { method: 'GET', path: '/api/health', url: `${API_ROOT_URL}/health`, query: health },
    { method: 'GET', path: '/api/v1', url: API_BASE_URL, query: apiV1 },
  ] as const

  return (
    <main className="theme-dark relative min-h-screen overflow-hidden bg-background font-status text-foreground">
      <div aria-hidden className="status-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="status-orb pointer-events-none absolute -left-24 top-10 size-80 rounded-full bg-gold/10 blur-3xl"
      />
      <div
        aria-hidden
        className="status-orb pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-success/5 blur-3xl"
        style={{ animationDelay: '1.4s' }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <header className="status-rise flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/denuwe-mark.png" alt="" className="size-10" />
            <div>
              <Wordmark className="block text-2xl text-white" />
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">System status</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={refetchAll}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm font-medium transition hover:border-gold/50 hover:text-gold disabled:opacity-60"
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            Re-check
          </button>
        </header>

        <section className="status-rise-delay mt-14 max-w-2xl">
          <div className="status-gold-line h-px w-40" />
          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            {overall === 'ok'
              ? 'Everything is connected.'
              : overall === 'loading'
                ? 'Checking the stack…'
                : 'Something needs attention.'}
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            The frontend (<code className="text-foreground">denuwe-core</code>) talks to the Laravel API (
            <code className="text-foreground">denuwe-ws</code>) through the Vite{' '}
            <code className="text-foreground">/api</code> proxy, and the API verifies its MySQL connection on every
            health check.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium',
                overall === 'ok' && 'bg-success/10 text-success',
                overall === 'error' && 'bg-danger/10 text-danger',
                overall === 'loading' && 'bg-secondary text-muted-foreground',
              )}
            >
              <StateIcon state={overall} />
              {overall === 'ok' ? 'All systems operational' : overall === 'loading' ? 'Running checks' : 'Degraded'}
            </span>
            {lastChecked ? (
              <span className="text-muted-foreground">
                Last checked {new Date(lastChecked).toLocaleTimeString()} · auto every {REFETCH_MS / 1000}s
              </span>
            ) : null}
          </div>
        </section>

        <section className="status-rise-delay-2 mt-12 rounded-2xl border border-border bg-card/60 px-6 py-6 backdrop-blur sm:px-10">
          <div className="flex items-center">
            <FlowNode label="Browser" state={frontendState} icon={<Globe className="size-5" />} />
            <FlowLink state={frontendState} />
            <FlowNode label="denuwe-core" state={frontendState} icon={<MonitorSmartphone className="size-5" />} />
            <FlowLink state={backendState} />
            <FlowNode label="denuwe-ws" state={backendState} icon={<Server className="size-5" />} />
            <FlowLink state={databaseState} />
            <FlowNode label="MySQL" state={databaseState} icon={<Database className="size-5" />} />
          </div>
        </section>

        <div className="status-rise-delay-2 mt-6 grid gap-6 md:grid-cols-3">
          <StatusCard
            title="Frontend"
            subtitle="denuwe-core · React + Vite"
            icon={<MonitorSmartphone className="size-5" />}
            state={frontendState}
            rows={[
              ['React', reactVersion],
              ['Mode', import.meta.env.MODE],
              ['Origin', window.location.origin],
              ['API base', API_BASE_URL],
            ]}
            footer={<span className="text-muted-foreground">Rendered and hydrated in your browser.</span>}
          />
          <StatusCard
            title="Backend API"
            subtitle="denuwe-ws · Laravel + JWT"
            icon={<Server className="size-5" />}
            state={backendState}
            rows={[
              ['Laravel', health.data?.data.laravel],
              ['PHP', health.data?.data.php],
              ['Environment', health.data?.data.env],
              ['Latency', health.data ? `${health.data.latencyMs} ms` : null],
            ]}
            footer={
              health.isError ? (
                <span className="text-danger">
                  {errorMessage(health.error)}. Start <code className="text-foreground">denuwe-ws</code> with{' '}
                  <code className="text-foreground">php artisan serve</code>.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Responding at <code className="text-foreground">/api/health</code>.
                </span>
              )
            }
          />
          <StatusCard
            title="Database"
            subtitle={`${db?.connection ?? 'mysql'} · via Laravel PDO`}
            icon={<Database className="size-5" />}
            state={databaseState}
            rows={[
              ['Database', db?.name],
              ['Server', db?.version],
              ['Query latency', db?.latency_ms != null ? `${db.latency_ms} ms` : null],
              ['Status', db?.status],
            ]}
            footer={
              db?.status === 'error' ? (
                <span className="text-danger">
                  {db.error ?? 'Connection failed'}. Start MySQL in XAMPP and create the{' '}
                  <code className="text-foreground">viclub</code> database.
                </span>
              ) : health.isError ? (
                <span className="text-muted-foreground">Unknown until the API is reachable.</span>
              ) : (
                <span className="text-muted-foreground">
                  <code className="text-foreground">select 1</code> succeeded.
                </span>
              )
            }
          />
        </div>

        <section className="status-rise-delay-3 mt-6 grid gap-6 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur lg:col-span-2">
            <h2 className="text-sm font-semibold">Endpoints</h2>
            <ul className="mt-4 divide-y divide-border">
              {endpoints.map(({ method, path, url, query }) => {
                const state: State = query.isPending
                  ? 'loading'
                  : query.isSuccess && query.data.status < 400
                    ? 'ok'
                    : 'error'
                return (
                  <li key={path} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-mono text-sm">
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                          {method}
                        </span>
                        {path}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{url}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground">
                      {query.data ? (
                        <span>
                          {query.data.status} · {query.data.latencyMs}ms
                        </span>
                      ) : null}
                      <StateIcon state={state} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur lg:col-span-3">
            <h2 className="text-sm font-semibold">
              Response · <span className="font-mono text-gold">/api/health</span>
            </h2>
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-background/80 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {health.data
                ? JSON.stringify(health.data.data, null, 2)
                : health.isError
                  ? errorMessage(health.error)
                  : 'Waiting for response…'}
            </pre>
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          denuwe foundation · denuwe-core + denuwe-ws + MySQL
        </footer>
      </div>
    </main>
  )
}
