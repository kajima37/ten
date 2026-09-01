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

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    base64UrlToBytes(signature),
    new TextEncoder().encode(encodePayload(playerId, expiresAt)),
  )
  return valid ? playerId : null
}

export async function hashIp(ip: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    new TextEncoder().encode(ip),
  )
  return bytesToBase64Url(new Uint8Array(signature))
}
