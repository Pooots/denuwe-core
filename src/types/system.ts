export type ApiRootResponse = {
  ok: boolean
  service: string
  name: string
  version: string
  health: string
  v1: string
}

export type ApiV1Response = {
  ok: boolean
  service: string
  version: string
  health: string
}

export type DatabaseHealth = {
  status: 'ok' | 'error'
  connection: string
  name: string | null
  version: string | null
  latency_ms: number | null
  error?: string
}

export type HealthResponse = {
  ok: boolean
  service: string
  status: 'healthy' | 'degraded'
  app: string
  env: string
  database: DatabaseHealth
  time: string
  php: string
  laravel: string
}

export type ProbeResult<T> = {
  url: string
  status: number
  latencyMs: number
  data: T
}
