export type AuthSession = {
  token: string
}

type AuthenticatedRequestOptions<TSession extends AuthSession, TResult> = {
  getSession: () => Promise<TSession | null>
  clearSession: () => void
  request: (token: string) => Promise<TResult>
}

function isUnauthorized(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 401
  )
}

export async function authenticatedRequest<
  TSession extends AuthSession,
  TResult,
>({
  getSession,
  clearSession,
  request,
}: AuthenticatedRequestOptions<TSession, TResult>): Promise<{
  result: TResult
  session: TSession
} | null> {
  let session = await getSession()
  if (!session) return null

  try {
    return { result: await request(session.token), session }
  } catch (error) {
    if (!isUnauthorized(error)) throw error
  }

  clearSession()
  session = await getSession()
  if (!session) return null

  return { result: await request(session.token), session }
}
