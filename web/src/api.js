export async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败（${res.status}）`)
    err.status = res.status
    err.code = data?.code
    throw err
  }
  return data
}

export const get = (path) => api(path)
export const post = (path, body) => api(path, { method: 'POST', body })
