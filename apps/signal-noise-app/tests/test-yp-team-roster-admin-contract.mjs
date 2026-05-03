import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'

import {
  normalizeLinkedinProfileUrl,
  parseYpTeamRosterCsv,
  readYpTeamRoster,
  writeYpTeamRoster,
} from '../src/lib/yp-team-roster.ts'

const routePath = new URL('../src/app/api/admin/yp-team/route.ts', import.meta.url)
const pagePath = new URL('../src/app/admin/yp-team/page.tsx', import.meta.url)

test('YP team admin route and page exist with the expected roster controls', () => {
  assert.equal(existsSync(routePath), true)
  assert.equal(existsSync(pagePath), true)

  const routeSource = readFileSync(routePath, 'utf8')
  const pageSource = readFileSync(pagePath, 'utf8')

  assert.match(routeSource, /requireApiSession/)
  assert.match(routeSource, /readYpTeamRoster/)
  assert.match(routeSource, /writeYpTeamRoster/)
  assert.match(routeSource, /export async function GET/)
  assert.match(routeSource, /export async function POST/)
  assert.match(routeSource, /export async function PATCH/)
  assert.match(routeSource, /export async function DELETE/)

  assert.match(pageSource, /\/api\/admin\/yp-team/)
  assert.match(pageSource, /yp_linkedin/)
  assert.match(pageSource, /status/)
  assert.match(pageSource, /display_order/)
  assert.match(pageSource, /Add member/)
})

test('YP team roster library normalizes profile URLs and rejects company URLs', () => {
  assert.equal(
    normalizeLinkedinProfileUrl('https://uk.linkedin.com/in/stuart-cope-54392b16/?trk=public_profile'),
    'https://www.linkedin.com/in/stuart-cope-54392b16/',
  )
  assert.throws(
    () => normalizeLinkedinProfileUrl('https://www.linkedin.com/company/yellow-panther/'),
    /person profile URL/,
  )
})

test('YP team roster library round-trips CSV rows with active and excluded members', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'yp-team-roster-'))
  const csvPath = path.join(tempDir, 'yp_team.csv')

  try {
    await writeYpTeamRoster(
      [
        {
          member_id: 'stuart-cope',
          display_order: 10,
          yp_name: 'Stuart Cope',
          yp_role: 'Co-Founder & COO',
          yp_linkedin: 'https://uk.linkedin.com/in/stuart-cope-54392b16/',
          yp_weight: 1.5,
          yp_expertise_1: 'Operations',
          yp_expertise_2: 'Client Relationships',
          yp_expertise_3: 'Strategic Partnerships',
          status: 'active',
        },
        {
          member_id: 'gunjan-parikh',
          display_order: 20,
          yp_name: 'Gunjan Parikh',
          yp_role: 'Founder & CEO',
          yp_linkedin: 'https://www.linkedin.com/in/gunjan-parikh/',
          yp_weight: 1.3,
          yp_expertise_1: 'Strategic Vision',
          yp_expertise_2: 'Business Development',
          yp_expertise_3: 'Client Strategy',
          status: 'excluded',
        },
      ],
      csvPath,
    )

    const source = await readFile(csvPath, 'utf8')
    assert.match(source, /member_id,display_order,yp_name/)
    assert.match(source, /gunjan-parikh/)

    const parsed = parseYpTeamRosterCsv(source)
    assert.equal(parsed.length, 2)
    assert.equal(parsed[0].yp_linkedin, 'https://www.linkedin.com/in/stuart-cope-54392b16/')

    const reread = await readYpTeamRoster(csvPath)
    assert.equal(reread[1].status, 'excluded')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
