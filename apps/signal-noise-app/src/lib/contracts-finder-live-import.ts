type ContractsFinderImportOptions = {
  searchUrl: string
  limit?: number
}

type ContractsFinderParsedNotice = {
  id: string
  title: string
  organization: string
  description: string | null
  location: string | null
  value: null
  deadline: string | null
  published: string | null
  source: string
  source_url: string
  url: string
  category: string
  status: string
  confidence: number
  yellow_panther_fit: number
  priority_score: number
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
}

function normalizeWhitespace(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseHumanDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const cleaned = value.split(',')[0].trim()
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!match) {
    return null
  }

  const [, dayText, monthText, yearText] = match
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  }
  const monthIndex = months[monthText.toLowerCase()]
  if (monthIndex === undefined) {
    return null
  }

  const iso = new Date(Date.UTC(Number(yearText), monthIndex, Number(dayText)))
  return iso.toISOString()
}

function parseDeadline(value: string | null | undefined) {
  const parsed = parseHumanDate(value)
  return parsed ? parsed.split('T')[0] : null
}

function parseNoticeId(sourceUrl: string) {
  const match = sourceUrl.match(/\/notice\/([0-9a-f-]+)/i)
  return match ? match[1] : null
}

function parseContractsFinderResultBlock(block: string): ContractsFinderParsedNotice | null {
  const titleMatch = block.match(
    /<a[^>]*href="([^"]*\/notice\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
  )

  if (!titleMatch) {
    return null
  }

  const sourceUrl = decodeHtmlEntities(titleMatch[1].trim())
  const id = parseNoticeId(sourceUrl)
  if (!id) {
    return null
  }

  const title = normalizeWhitespace(titleMatch[2])
  const organizationMatch = block.match(
    /<div class="search-result-sub-header wrap-text">([\s\S]*?)<\/div>/i,
  )
  const descriptionMatch = block.match(
    /<div class="wrap-text">([\s\S]*?)<\/div>\s*<div class="search-result-entry"><strong>Procurement stage/i,
  )
  const locationMatch = block.match(
    /<div class="search-result-entry"><strong>Contract location<\/strong>\s*([^<]+)<\/div>/i,
  )
  const closingMatch = block.match(
    /<div class="search-result-entry"><strong>Closing<\/strong>\s*([^<]+)<\/div>/i,
  )
  const publicationMatch = block.match(
    /<div class="search-result-entry"><strong>Publication date<\/strong>\s*([^<]+)<\/div>/i,
  )

  const organization = organizationMatch ? normalizeWhitespace(organizationMatch[1]) : 'Unknown Organization'
  const description = descriptionMatch ? normalizeWhitespace(descriptionMatch[1]) : null
  const location = locationMatch ? normalizeWhitespace(locationMatch[1]) : null

  return {
    id: `contracts-finder-${id}`,
    title,
    organization,
    description,
    location,
    value: null,
    deadline: parseDeadline(closingMatch?.[1] || null),
    published: parseHumanDate(publicationMatch?.[1] || null),
    source: 'Contracts Finder',
    source_url: sourceUrl,
    url: sourceUrl,
    category: 'Government Procurement',
    status: 'qualified',
    confidence: 0.82,
    yellow_panther_fit: 80,
    priority_score: 8,
  }
}

export function extractContractsFinderOpportunities(
  html: string,
  options: ContractsFinderImportOptions,
) {
  const limit = Math.max(1, Math.min(Number(options.limit || 20), 100))
  const blocks = html.split('<div class="search-result">').slice(1)
  const notices: ContractsFinderParsedNotice[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    const notice = parseContractsFinderResultBlock(block)
    if (!notice) {
      continue
    }

    if (seen.has(notice.source_url)) {
      continue
    }

    seen.add(notice.source_url)
    notices.push(notice)

    if (notices.length >= limit) {
      break
    }
  }

  return notices
}

export async function loadContractsFinderOpportunities(
  options: ContractsFinderImportOptions & { pages?: number; query?: string },
) {
  const pages = Math.max(1, Math.min(Number(options.pages || 1), 5))
  const query = String(options.query || 'sports technology digital transformation fan engagement').trim()
  const limit = Math.max(1, Math.min(Number(options.limit || 20), 100))
  const allNotices: ContractsFinderParsedNotice[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= pages; page += 1) {
    const searchUrl = `${options.searchUrl}?Page=${page}&sort=CloseDate-desc&search=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`Contracts Finder search failed: ${response.status}`)
    }

    const html = await response.text()
    const notices = extractContractsFinderOpportunities(html, {
      searchUrl,
      limit: Math.max(1, limit - allNotices.length),
    })

    for (const notice of notices) {
      if (seen.has(notice.source_url)) {
        continue
      }
      seen.add(notice.source_url)
      allNotices.push(notice)

      if (allNotices.length >= limit) {
        break
      }
    }

    if (allNotices.length >= limit) {
      break
    }
  }

  return allNotices
}
