const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

function encodePayload(playerId: string, expiresAt: number): string {
  return `${playerId}.${expiresAt}`
}

export async function signToken(
  playerId: string,
  secret: string,
  now = Date.now(),
): Promise<string> {
  const expiresAt = now + TOKEN_TTL_MS
  const payload = encodePayload(playerId, expiresAt)
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(payload),
  )
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [playerId, expiresAtRaw, signature] = parts
  if (!playerId || !expiresAtRaw || !signature) return null
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < now) return null

  let signatureBytes: Uint8Array
  try {
    signatureBytes = base64UrlToBytes(signature)
  } catch {
    return null
  }
  if (bytesToBase64Url(signatureBytes) !== signature) return null

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    new TextEncoder().encode(encodePayload(playerId, expiresAt)),
  )
  return valid ? playerId : null
}

export type DailyStart = {
  playerId: string
  dateKey: string
  expiresAt: number
}

function encodeDailyStart(start: DailyStart): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(start)))
}

export async function signDailyStartToken(
  playerId: string,
  dateKey: string,
  secret: string,
  expiresAt: number,
): Promise<string> {
  const payload = encodeDailyStart({ playerId, dateKey, expiresAt })
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(`daily-start.${payload}`),
  )
  return `daily-start.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export async function verifyDailyStartToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<DailyStart | null> {
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'daily-start') return null
  const [, payload, signature] = parts
  if (!payload || !signature) return null

  let signatureBytes: Uint8Array
  let start: DailyStart
  try {
    signatureBytes = base64UrlToBytes(signature)
    if (bytesToBase64Url(signatureBytes) !== signature) return null
    start = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload)),
    ) as DailyStart
  } catch {
    return null
  }
  if (
    typeof start.playerId !== 'string' ||
    typeof start.dateKey !== 'string' ||
    !Number.isFinite(start.expiresAt) ||
    start.expiresAt < now
  ) {
    return null
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    signatureBytes,
    new TextEncoder().encode(`daily-start.${payload}`),
  )
  return valid ? start : null
}

export async function hashIp(ip: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(ip),
  )
  return bytesToBase64Url(new Uint8Array(signature))
}
