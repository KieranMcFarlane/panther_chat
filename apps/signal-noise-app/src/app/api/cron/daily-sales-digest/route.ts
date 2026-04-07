import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

import { requireCronSecret } from '@/lib/cron-auth'
import { buildSalesActionDigest } from '@/lib/graphiti-insight-materializer'
import { loadPersistedGraphitiInsights, markGraphitiNotificationsSent } from '@/lib/graphiti-persistence'
import { getSupabaseAdmin } from '@/lib/supabase-client'
import { UnauthorizedError } from '@/lib/server-auth'

function getLondonDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function renderDigestHtml(digest: ReturnType<typeof buildSalesActionDigest>) {
  const renderSection = (title: string, items: Array<{ entity_name: string; title: string; why_it_matters: string; suggested_action: string }>) => `
    <h2>${title}</h2>
    <ul>
      ${items.map((item) => `<li><strong>${item.entity_name}</strong>: ${item.title}<br/>${item.why_it_matters}<br/><em>${item.suggested_action}</em></li>`).join('')}
    </ul>
  `

  return `
    <html>
      <body>
        <h1>Sales Action Outlook</h1>
        ${renderSection('Top opportunities', digest.top_opportunities)}
        ${renderSection('What changed since yesterday', digest.changed_since_yesterday)}
        ${renderSection('Entities needing action', digest.entities_needing_action)}
        ${renderSection('Entities needing review or rerun', digest.entities_needing_review_or_rerun)}
      </body>
    </html>
  `
}

export async function POST(request: NextRequest) {
  try {
    requireCronSecret(request)
    const supabase = getSupabaseAdmin()
    const windowKey = getLondonDateKey()
    const configKey = 'daily_sales_digest_last_window'

    const currentWindow = await supabase
      .from('sync_config')
      .select('config_value')
      .eq('config_key', configKey)
      .maybeSingle()

    if (!currentWindow.error && currentWindow.data?.config_value?.window_key === windowKey) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'Digest already sent for this London business day' })
    }

    const { highlights } = await loadPersistedGraphitiInsights(50)
    const digest = buildSalesActionDigest(highlights)
    const resendApiKey = process.env.RESEND_API_KEY
    const from = process.env.AUTH_EMAIL_FROM || process.env.RESEND_FROM_EMAIL
    const to = process.env.SALES_DIGEST_TO

    if (!resendApiKey || !from || !to) {
      return NextResponse.json({ digest, sent: false, reason: 'Missing RESEND_API_KEY, sender, or SALES_DIGEST_TO' })
    }

    const resend = new Resend(resendApiKey)
    const result = await resend.emails.send({
      from,
      to: [to],
      subject: 'Daily sales action outlook',
      html: renderDigestHtml(digest),
    })

    const sentInsightIds = Array.from(new Set([
      ...digest.top_opportunities,
      ...digest.changed_since_yesterday,
      ...digest.entities_needing_action,
      ...digest.entities_needing_review_or_rerun,
    ].map((item) => item.insight_id).filter(Boolean)))

    await Promise.all([
      markGraphitiNotificationsSent(sentInsightIds),
      supabase.from('sync_config').upsert({
        config_key: configKey,
        config_value: {
          window_key: windowKey,
          sent_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'config_key' }),
    ])

    console.log('Daily sales digest cron completed', { windowKey, sentInsightIds: sentInsightIds.length })
    return NextResponse.json({ ok: true, digest, sent: true, result })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Daily sales digest cron failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send daily sales digest' },
      { status: 500 },
    )
  }
}
