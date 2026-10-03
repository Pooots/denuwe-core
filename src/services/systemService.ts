import type {
  ApiRootResponse,
  ApiV1Response,
  HealthResponse,
  ProbeResult,
} from '@/types/system'
import { API_BASE_URL, API_ROOT_URL, api, rootApi } from '@/lib/api'

async function timed<T>(
  url: string,
  request: () => Promise<{ status: number; data: T }>,
): Promise<ProbeResult<T>> {
  const started = performance.now()
  const res = await request()
  return {
    url,
    status: res.status,
    latencyMs: Math.round(performance.now() - started),
    data: res.data,
  }
}

export const systemService = {
  apiRoot: () =>
    timed(API_ROOT_URL, () => rootApi.get<ApiRootResponse>('/')),

  // 503 means the API is up but degraded (e.g. database down) — keep the body.
  health: () =>
    timed(`${API_ROOT_URL}/health`, () =>
      rootApi.get<HealthResponse>('/health', {
        validateStatus: (status) => status === 200 || status === 503,
      }),
    ),

  apiV1: () => timed(API_BASE_URL, () => api.get<ApiV1Response>('/')),
}
