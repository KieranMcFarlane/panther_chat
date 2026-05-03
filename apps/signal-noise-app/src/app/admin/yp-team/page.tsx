'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { AppPageBody, AppPageHeader, AppPageShell } from '@/components/layout/AppPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type YpTeamStatus = 'active' | 'excluded'

type YpTeamMember = {
  member_id: string
  display_order: number
  yp_name: string
  yp_role: string
  yp_linkedin: string
  yp_weight: number
  yp_expertise_1: string
  yp_expertise_2: string
  yp_expertise_3: string
  status: YpTeamStatus
}

type ValidationIssue = {
  field: string
  message: string
}

const EMPTY_MEMBER: YpTeamMember = {
  member_id: '',
  display_order: 10,
  yp_name: '',
  yp_role: '',
  yp_linkedin: '',
  yp_weight: 1,
  yp_expertise_1: '',
  yp_expertise_2: '',
  yp_expertise_3: '',
  status: 'active',
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'member'
}

export default function YpTeamAdminPage() {
  const [rows, setRows] = useState<YpTeamMember[]>([])
  const [drafts, setDrafts] = useState<Record<string, YpTeamMember>>({})
  const [newMember, setNewMember] = useState<YpTeamMember>(EMPTY_MEMBER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<Record<string, ValidationIssue[]>>({})

  const summary = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.status === 'active').length,
      excluded: rows.filter((row) => row.status === 'excluded').length,
    }
  }, [rows])

  const syncDrafts = useCallback((nextRows: YpTeamMember[]) => {
    const nextDrafts: Record<string, YpTeamMember> = {}
    for (const row of nextRows) {
      nextDrafts[row.member_id] = { ...row }
    }
    setDrafts(nextDrafts)
  }, [])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/yp-team', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load roster (${response.status})`)
      }
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : []
      setRows(nextRows)
      syncDrafts(nextRows)
      setNewMember({
        ...EMPTY_MEMBER,
        display_order: nextRows.length > 0 ? Math.max(...nextRows.map((row: YpTeamMember) => row.display_order)) + 10 : 10,
      })
      setIssues({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster')
    } finally {
      setLoading(false)
    }
  }, [syncDrafts])

  useEffect(() => {
    loadRows()
  }, [loadRows])

  const setRowDraft = (memberId: string, field: keyof YpTeamMember, value: string | number) => {
    setDrafts((current) => ({
      ...current,
      [memberId]: {
        ...(current[memberId] || rows.find((row) => row.member_id === memberId) || EMPTY_MEMBER),
        [field]: value,
      },
    }))
    setIssues((current) => ({ ...current, [memberId]: [] }))
  }

  const resetRowDraft = (memberId: string) => {
    const source = rows.find((row) => row.member_id === memberId)
    if (!source) return
    setDrafts((current) => ({ ...current, [memberId]: { ...source } }))
    setIssues((current) => ({ ...current, [memberId]: [] }))
  }

  const patchMember = async (memberId: string, updates: YpTeamMember) => {
    const response = await fetch('/api/admin/yp-team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, updates }),
    })
    const payload = await response.json()
    if (!response.ok) {
      if (Array.isArray(payload?.issues)) {
        setIssues((current) => ({ ...current, [memberId]: payload.issues }))
      }
      throw new Error(payload?.error || `Failed to save member (${response.status})`)
    }
    return payload
  }

  const saveExisting = async (memberId: string) => {
    const draft = drafts[memberId]
    if (!draft) return
    setSaving(memberId)
    setError(null)
    try {
      const payload = await patchMember(memberId, draft)
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : rows
      setRows(nextRows)
      syncDrafts(nextRows)
      setIssues((current) => ({ ...current, [memberId]: [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save member')
    } finally {
      setSaving(null)
    }
  }

  const removeMember = async (memberId: string) => {
    setSaving(memberId)
    setError(null)
    try {
      const response = await fetch('/api/admin/yp-team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to delete member (${response.status})`)
      }
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : []
      setRows(nextRows)
      syncDrafts(nextRows)
      setIssues((current) => {
        const next = { ...current }
        delete next[memberId]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete member')
    } finally {
      setSaving(null)
    }
  }

  const reorderMember = async (memberId: string, direction: -1 | 1) => {
    const ordered = [...rows]
    const index = ordered.findIndex((row) => row.member_id === memberId)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return
    ;[ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]]
    const reassigned = ordered.map((row, idx) => ({ ...row, display_order: (idx + 1) * 10 }))
    const affectedIds = [reassigned[index].member_id, reassigned[swapIndex].member_id]
    setRows(reassigned)
    syncDrafts(reassigned)
    setSaving(memberId)
    setError(null)
    try {
      let latestRows = reassigned
      for (const affectedId of affectedIds) {
        const affectedDraft = reassigned.find((row) => row.member_id === affectedId)
        if (!affectedDraft) continue
        const payload = await patchMember(affectedId, affectedDraft)
        latestRows = Array.isArray(payload?.rows) ? payload.rows : latestRows
      }
      setRows(latestRows)
      syncDrafts(latestRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder member')
      setRows(rows)
      syncDrafts(rows)
    } finally {
      setSaving(null)
    }
  }

  const createMember = async () => {
    const candidate = {
      ...newMember,
      member_id: newMember.member_id.trim() || slugify(newMember.yp_name),
    }
    setSaving('new')
    setError(null)
    try {
      const response = await fetch('/api/admin/yp-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member: candidate }),
      })
      const payload = await response.json()
      if (!response.ok) {
        if (Array.isArray(payload?.issues)) {
          setIssues((current) => ({ ...current, new: payload.issues }))
        }
        throw new Error(payload?.error || `Failed to create member (${response.status})`)
      }
      const nextRows = Array.isArray(payload?.rows) ? payload.rows : []
      setRows(nextRows)
      syncDrafts(nextRows)
      setNewMember({
        ...EMPTY_MEMBER,
        display_order: nextRows.length > 0 ? Math.max(...nextRows.map((row: YpTeamMember) => row.display_order)) + 10 : 10,
      })
      setIssues((current) => ({ ...current, new: [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setSaving(null)
    }
  }

  return (
    <AppPageShell size="wide">
      <AppPageHeader
        eyebrow="Admin"
        title="Yellow Panther Team"
        description="Manage the CSV-backed roster used by connections scoring, question-first connections graphs, and outreach routing."
        actions={
          <>
            <Badge variant="outline">{summary.total} members</Badge>
            <Badge variant="outline">{summary.active} active</Badge>
            <Badge variant="secondary">{summary.excluded} excluded</Badge>
            <Button variant="outline" size="sm" onClick={() => loadRows()}>Refresh</Button>
          </>
        }
      />

      <AppPageBody>
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Add Member</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Input
              placeholder="Name"
              value={newMember.yp_name}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_name: event.target.value }))}
            />
            <Input
              placeholder="Role"
              value={newMember.yp_role}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_role: event.target.value }))}
            />
            <Input
              placeholder="LinkedIn profile URL"
              value={newMember.yp_linkedin}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_linkedin: event.target.value }))}
            />
            <Input
              placeholder="Weight"
              type="number"
              step="0.1"
              value={newMember.yp_weight}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_weight: Number(event.target.value || 1) }))}
            />
            <Select
              value={newMember.status}
              onValueChange={(value) => setNewMember((current) => ({ ...current, status: value as YpTeamStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Expertise 1"
              value={newMember.yp_expertise_1}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_expertise_1: event.target.value }))}
            />
            <Input
              placeholder="Expertise 2"
              value={newMember.yp_expertise_2}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_expertise_2: event.target.value }))}
            />
            <Input
              placeholder="Expertise 3"
              value={newMember.yp_expertise_3}
              onChange={(event) => setNewMember((current) => ({ ...current, yp_expertise_3: event.target.value }))}
            />
            <Input
              placeholder="Display order"
              type="number"
              value={newMember.display_order}
              onChange={(event) => setNewMember((current) => ({ ...current, display_order: Number(event.target.value || 10) }))}
            />
            <div className="flex items-center justify-end">
              <Button onClick={createMember} disabled={saving === 'new'}>
                {saving === 'new' ? 'Saving…' : 'Add member'}
              </Button>
            </div>
            {issues.new?.length ? (
              <div className="md:col-span-2 xl:col-span-5 text-sm text-red-600">
                {issues.new.map((issue) => `${issue.field}: ${issue.message}`).join(' · ')}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Roster</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading roster…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => {
                    const draft = drafts[row.member_id] || row
                    const rowIssues = issues[row.member_id] || []
                    return (
                      <TableRow key={row.member_id}>
                        <TableCell className="min-w-[14rem]">
                          <div className="space-y-2">
                            <Input
                              value={draft.yp_name}
                              onChange={(event) => setRowDraft(row.member_id, 'yp_name', event.target.value)}
                            />
                            <p className="text-xs text-muted-foreground font-mono">{row.member_id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[12rem]">
                          <Input
                            value={draft.yp_role}
                            onChange={(event) => setRowDraft(row.member_id, 'yp_role', event.target.value)}
                          />
                        </TableCell>
                        <TableCell className="min-w-[18rem]">
                          <Input
                            value={draft.yp_linkedin}
                            onChange={(event) => setRowDraft(row.member_id, 'yp_linkedin', event.target.value)}
                          />
                        </TableCell>
                        <TableCell className="w-28">
                          <Input
                            type="number"
                            step="0.1"
                            value={draft.yp_weight}
                            onChange={(event) => setRowDraft(row.member_id, 'yp_weight', Number(event.target.value || 1))}
                          />
                        </TableCell>
                        <TableCell className="w-36">
                          <div className="space-y-2">
                            <Select
                              value={draft.status}
                              onValueChange={(value) => setRowDraft(row.member_id, 'status', value as YpTeamStatus)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="excluded">Excluded</SelectItem>
                              </SelectContent>
                            </Select>
                            <Badge variant={draft.status === 'active' ? 'default' : 'secondary'}>{draft.status}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[18rem]">
                          <div className="grid gap-2">
                            <Input
                              placeholder="Expertise 1"
                              value={draft.yp_expertise_1}
                              onChange={(event) => setRowDraft(row.member_id, 'yp_expertise_1', event.target.value)}
                            />
                            <Input
                              placeholder="Expertise 2"
                              value={draft.yp_expertise_2}
                              onChange={(event) => setRowDraft(row.member_id, 'yp_expertise_2', event.target.value)}
                            />
                            <Input
                              placeholder="Expertise 3"
                              value={draft.yp_expertise_3}
                              onChange={(event) => setRowDraft(row.member_id, 'yp_expertise_3', event.target.value)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-28">
                          <Input
                            type="number"
                            value={draft.display_order}
                            onChange={(event) => setRowDraft(row.member_id, 'display_order', Number(event.target.value || row.display_order))}
                          />
                        </TableCell>
                        <TableCell className="min-w-[12rem]">
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => reorderMember(row.member_id, -1)} disabled={index === 0 || saving === row.member_id}>
                                Up
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => reorderMember(row.member_id, 1)} disabled={index === rows.length - 1 || saving === row.member_id}>
                                Down
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveExisting(row.member_id)} disabled={saving === row.member_id}>
                                {saving === row.member_id ? 'Saving…' : 'Save'}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => resetRowDraft(row.member_id)}>
                                Reset
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => removeMember(row.member_id)} disabled={saving === row.member_id}>
                                Remove
                              </Button>
                            </div>
                            {rowIssues.length ? (
                              <p className="max-w-xs text-right text-xs text-red-600">
                                {rowIssues.map((issue) => `${issue.field}: ${issue.message}`).join(' · ')}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
      </AppPageBody>
    </AppPageShell>
  )
}
