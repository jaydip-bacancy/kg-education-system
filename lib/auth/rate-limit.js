const globalForRateLimit = globalThis

const store = globalForRateLimit.__rateLimitStore__ ?? new Map()

if (!globalForRateLimit.__rateLimitStore__) {
  globalForRateLimit.__rateLimitStore__ = store
}

export function rateLimit({ key, limit, windowMs }) {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  store.set(key, entry)

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}