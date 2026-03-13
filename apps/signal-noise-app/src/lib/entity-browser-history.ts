export function rememberEntityBrowserUrl(url?: string): void {
  if (typeof window === 'undefined') return

  const candidate =
    url ||
    `${window.location.pathname}${window.location.search}${window.location.hash}` ||
    ''

  if (!candidate || !candidate.startsWith('/entity-browser')) return

  try {
    sessionStorage.setItem('lastEntityBrowserUrl', candidate)
    const nextState = { ...(window.history.state || {}), entityBrowserUrl: candidate }
    window.history.replaceState(nextState, '', window.location.href)
  } catch {
    // Non-blocking storage failure
  }
}

export function resolveEntityBrowserReturnUrl(fromPage: string = '1'): string {
  const fallback = fromPage !== '1' ? `/entity-browser?page=${fromPage}` : '/entity-browser'
  if (typeof window === 'undefined') return fallback

  try {
    const stateUrl = String((window.history.state as any)?.entityBrowserUrl || '').trim()
    if (stateUrl.startsWith('/entity-browser')) return stateUrl

    const sessionUrl = String(sessionStorage.getItem('lastEntityBrowserUrl') || '').trim()
    if (sessionUrl.startsWith('/entity-browser')) return sessionUrl
  } catch {
    // ignore storage access issues
  }

  return fallback
}
