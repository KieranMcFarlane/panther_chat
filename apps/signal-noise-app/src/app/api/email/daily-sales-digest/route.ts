import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

import { buildSalesActionDigest, materializeGraphitiInsight, rankGraphitiInsights } from '@/lib/graphiti-insight-materializer'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-client'

const HOME_INSIGHT_COLUMNS = [
  'insight_id',
  'entity_id',
  'entity_name',
  'entity_type',
  'sport',
  'league',
  'title',
  'summary',
  'why_it_matters',
  'confidence',
  'freshness',
  'evidence',
  'relationships',
  'suggested_action',
  'detected_at',
  'source_run_id',
  'source_signal_id',
  'source_episode_id',
  'source_objective',
  'materialized_at',
  'raw_payload',
].join(', ')

async function loadInsights() {
  const supabase = getSupabaseAdmin()
  const response = await supabase
    .from('homepage_graphiti_insights')
    .select(HOME_INSIGHT_COLUMNS)
    .order('materialized_at', { ascending: false })
    .limit(50)

  if (response.error) {
    throw new Error(response.error.message)
  }

  const rows = Array.isArray(response.data) ? response.data : []
  return rankGraphitiInsights(rows.map((row) => materializeGraphitiInsight(row)))
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

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const digest = buildSalesActionDigest(await loadInsights())
    return NextResponse.json({ digest })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build sales digest' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)

    const digest = buildSalesActionDigest(await loadInsights())
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

    return NextResponse.json({ digest, sent: true, result })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send sales digest' },
      { status: 500 },
    )
  }
}
