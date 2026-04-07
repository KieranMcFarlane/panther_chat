import { UnauthorizedError } from '@/lib/server-auth'

export function requireCronSecret(request: Request) {
  const secret = String(process.env.CRON_SECRET || '').trim()
  if (!secret) {
    throw new UnauthorizedError('CRON_SECRET is not configured')
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  if (authHeader !== `Bearer ${secret}`) {
    throw new UnauthorizedError('Invalid cron authorization')
  }
}
