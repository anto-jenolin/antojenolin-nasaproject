import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000, // 90s — allows for Render free-tier cold-starts and heavy ML ops
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — clear tokens and redirect to login
// Skip redirect for /auth/me and /auth/login (initial session check)
// to avoid a blink/redirect loop when the token is simply expired on page load.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    const status: number = err.response?.status

    if (status === 401) {
      const isSilent = url.includes('/auth/me') || url.includes('/auth/login')
      if (!isSilent) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      }
    }

    // Surface Render's "high traffic" 503 message as a readable error
    if (status === 503) {
      const detail =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Server is busy (high traffic). Please wait a moment and try again.'
      err.message = detail
      ;(err as any).isHighTraffic = true
    }

    return Promise.reject(err)
  }
)

export default api

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
}

// ── Dataset ───────────────────────────────────────────────────────────────────
export const datasetApi = {
  stats: () => api.get('/dataset/stats'),
  catalog: () => api.get('/dataset/catalog'),
  schema: () => api.get('/dataset/schema'),
  variables: () => api.get('/dataset/variables'),
  preview: (params: Record<string, unknown>) => api.get('/dataset/preview', { params }),
  quality: (params: Record<string, unknown>) => api.get('/dataset/quality', { params }),
}

// ── Explorer ──────────────────────────────────────────────────────────────────
// NOTE: Backend uses /explorer/timeseries (no hyphen) and /explorer/grid
// Grid response shape: { variable, resolution_deg, cell_count, grid: [{lat,lon,value,count}] }
// Timeseries response shape: { variable, series: [{date, mean, std, pixel_count}], count }
export const explorerApi = {
  grid: (params: Record<string, unknown>) => api.get('/explorer/grid', { params }),
  timeSeries: (params: Record<string, unknown>) => api.get('/explorer/timeseries', { params }),
  regions: () => api.get('/explorer/regions'),
  saveRegion: (body: Record<string, unknown>) => api.post('/explorer/regions', body),
  deleteRegion: (id: number) => api.delete(`/explorer/regions/${id}`),
  runAnalysis: (body: Record<string, unknown>, params?: Record<string, unknown>) => api.post('/explorer/analysis', body, { params }),
  exportCsv: (params: Record<string, unknown>) => api.get('/explorer/export', { params }),
  variables: () => api.get('/explorer/variables'),
}

// ── ML ────────────────────────────────────────────────────────────────────────
export const mlApi = {
  models: () => api.get('/ml/models'),
  experiments: () => api.get('/ml/experiments'),
  train: (body: Record<string, unknown>) => api.post('/ml/train', body),
  jobStatus: (id: number) => api.get(`/ml/job/${id}`),
  artifacts: () => api.get('/ml/artifacts'),
  predict: (body: Record<string, unknown>) => api.post('/ml/predict', body),
}

// ── XAI ───────────────────────────────────────────────────────────────────────
export const xaiApi = {
  globalExplain: (body: Record<string, unknown>) => api.post('/xai/global', body),
  localExplain: (body: Record<string, unknown>) => api.post('/xai/local', body),
  pdp: (body: Record<string, unknown>) => api.post('/xai/pdp', body),
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  status: () => api.get('/chat/status'),
  test: () => api.post('/chat/test'),
  /** Send a message. Returns StreamingResponse for stream:true. */
  message: (messages: Array<{role: string; content: string}>, context?: Record<string, unknown>, stream = false) =>
    api.post('/chat/message', { messages, context, stream }),
}

// ── Preprocessing ─────────────────────────────────────────────────────────────
export const preprocessingApi = {
  options: () => api.get('/preprocessing/options'),
  preview: (body: Record<string, unknown>) => api.post('/preprocessing/preview', body),
  run: (body: Record<string, unknown>) => api.post('/preprocessing/run', body),
  jobs: () => api.get('/preprocessing/jobs'),
  job: (id: number) => api.get(`/preprocessing/jobs/${id}`),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
// NOTE: updateUser uses PATCH (not PUT) to match backend
// NOTE: auditLogs uses /admin/audit (not /admin/audit-logs)
export const adminApi = {
  users: () => api.get('/admin/users'),
  updateUser: (id: number, body: Record<string, unknown>) => api.patch(`/admin/users/${id}`, body),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),
  createUser: (body: Record<string, unknown>) => api.post('/admin/users', body),
  auditLogs: (params?: Record<string, unknown>) => api.get('/admin/audit', { params }),
  systemStats: () => api.get('/admin/system'),
  jobs: (params?: Record<string, unknown>) => api.get('/admin/jobs', { params }),
}

// ── Health ────────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health'),
}

// ── Streaming chat helper ─────────────────────────────────────────────────────
/** 
 * Opens a streaming SSE connection to /api/chat/message.
 * onChunk receives each text delta. onDone fires when [DONE] received.
 * Returns an AbortController for cancellation.
 */
export function streamChat(
  messages: Array<{role: string; content: string}>,
  context: Record<string, unknown> | undefined,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): AbortController {
  const controller = new AbortController()
  const token = localStorage.getItem('access_token')

  fetch('/api/chat/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, context, stream: true }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      onError(`HTTP ${res.status}`)
      return
    }
    const reader = res.body?.getReader()
    if (!reader) { onError('No response body'); return }
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6)
          if (payload === '[DONE]') { onDone(); return }
          onChunk(payload)
        }
      }
    }
    onDone()
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(String(err))
  })

  return controller
}
