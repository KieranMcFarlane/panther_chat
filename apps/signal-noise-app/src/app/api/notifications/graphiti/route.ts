import { NextRequest, NextResponse } from 'next/server'

import { buildGraphitiNotificationPayload } from '@/lib/graphiti-insight-materializer'
import { loadGraphitiInsights } from '@/lib/graphiti-insight-loader'
import { loadPersistedGraphitiNotifications, markGraphitiNotificationsRead } from '@/lib/graphiti-persistence'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    try {
      const notifications = await loadPersistedGraphitiNotifications(25)
      if (notifications.length > 0) {
        return NextResponse.json({ notifications })
      }
    } catch (error) {
      console.error('Graphiti notification persistence read failed', { error })
    }

    const { highlights } = await loadGraphitiInsights(25)
    const notifications = highlights.map((insight) => {
      const notification = buildGraphitiNotificationPayload(insight)
      return {
        ...notification,
        destination_url: notification.destination_url,
      }
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Graphiti notifications' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({}))
    const action = String(body?.action || 'mark_all_read')
    const insightIds = Array.isArray(body?.insight_ids) ? body.insight_ids.map((value: unknown) => String(value || '')).filter(Boolean) : []

    if (!['mark_all_read', 'mark_read'].includes(action)) {
      return NextResponse.json({ error: 'Unsupported notification action' }, { status: 400 })
    }

    await markGraphitiNotificationsRead(action === 'mark_read' ? insightIds : undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update Graphiti notifications' },
      { status: 500 },
    )
  }
}
