import { NextRequest, NextResponse } from 'next/server'

import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import {
  readYpTeamRoster,
  summarizeYpTeamRoster,
  validateYpTeamMember,
  writeYpTeamRoster,
} from '@/lib/yp-team-roster'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function validationError(issues: Array<{ field: string; message: string }>, status = 400) {
  return NextResponse.json({ error: 'Invalid YP team member payload', issues }, { status })
}

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const rows = await readYpTeamRoster()
    return NextResponse.json({
      ok: true,
      rows,
      summary: summarizeYpTeamRoster(rows),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load YP team roster' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const payload = await request.json()
    const candidate = payload?.member ?? payload
    const existing = await readYpTeamRoster()
    const { member, issues } = validateYpTeamMember(candidate, { fallbackOrder: (existing.length + 1) * 10 })
    if (!member) {
      return validationError(issues)
    }
    if (existing.some((row) => row.member_id === member.member_id)) {
      return validationError([{ field: 'member_id', message: 'member_id already exists' }], 409)
    }

    const nextRows = [...existing, member]
    await writeYpTeamRoster(nextRows)
    return NextResponse.json({
      ok: true,
      row: member,
      rows: nextRows,
      summary: summarizeYpTeamRoster(nextRows),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create YP team member' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireApiSession(request)
    const payload = await request.json()
    const memberId = String(payload?.member_id || payload?.memberId || '').trim()
    if (!memberId) {
      return validationError([{ field: 'member_id', message: 'member_id is required' }])
    }

    const rows = await readYpTeamRoster()
    const current = rows.find((row) => row.member_id === memberId)
    if (!current) {
      return NextResponse.json({ error: 'YP team member not found' }, { status: 404 })
    }

    const merged = { ...current, ...(payload?.updates ?? payload?.member ?? {}) }
    const { member, issues } = validateYpTeamMember(merged, { fallbackOrder: current.display_order })
    if (!member) {
      return validationError(issues)
    }
    member.member_id = current.member_id

    const nextRows = rows.map((row) => (row.member_id === memberId ? member : row))
    await writeYpTeamRoster(nextRows)
    return NextResponse.json({
      ok: true,
      row: member,
      rows: nextRows,
      summary: summarizeYpTeamRoster(nextRows),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update YP team member' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireApiSession(request)
    const payload = await request.json()
    const memberId = String(payload?.member_id || payload?.memberId || '').trim()
    if (!memberId) {
      return validationError([{ field: 'member_id', message: 'member_id is required' }])
    }

    const rows = await readYpTeamRoster()
    const nextRows = rows.filter((row) => row.member_id !== memberId)
    if (nextRows.length === rows.length) {
      return NextResponse.json({ error: 'YP team member not found' }, { status: 404 })
    }

    await writeYpTeamRoster(nextRows)
    return NextResponse.json({
      ok: true,
      rows: nextRows,
      summary: summarizeYpTeamRoster(nextRows),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete YP team member' },
      { status: 500 },
    )
  }
}
