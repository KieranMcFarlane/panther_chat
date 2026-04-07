import { getServerSession, UnauthorizedError, requireApiSession } from '@/lib/server-auth'

function getConfiguredOperatorEmails() {
  return String(
    process.env.SIGNAL_NOISE_OPERATOR_EMAILS ||
      process.env.OPERATOR_EMAILS ||
      process.env.ADMIN_EMAILS ||
      '',
  )
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function isOperatorEmail(email: string | null | undefined) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false

  const configured = getConfiguredOperatorEmails()
  if (configured.length === 0) {
    return true
  }

  return configured.includes(normalized)
}

export async function requireOperatorApiSession(request: Request) {
  const session = await requireApiSession(request)
  const email = String(session.user.email || '').trim().toLowerCase()

  if (!isOperatorEmail(email)) {
    throw new UnauthorizedError('Operator access required')
  }

  return session
}

export async function getOperatorSession() {
  const session = await getServerSession()
  const email = String(session?.user?.email || '').trim().toLowerCase()

  return {
    session,
    isOperator: Boolean(session?.session && session.user && isOperatorEmail(email)),
  }
}
