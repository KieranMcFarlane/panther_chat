function isEntityBrowserListUrl(url: string): boolean {
  return /^\/entity-browser(?:$|\?)/.test(url)
}

export function rememberEntityBrowserUrl(url?: string): void {
  if (typeof window === 'undefined') return

  const candidate =
    url ||
    `${window.location.pathname}${window.location.search}${window.location.hash}` ||
    ''

  if (!candidate || !isEntityBrowserListUrl(candidate)) return

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
  const preferFallbackForPagedFrom = fromPage !== '1'
  if (typeof window === 'undefined') return fallback

  try {
    const stateUrl = String((window.history.state as any)?.entityBrowserUrl || '').trim()
    if (isEntityBrowserListUrl(stateUrl)) {
      if (preferFallbackForPagedFrom && !stateUrl.includes('?')) {
        return fallback
      }
      return stateUrl
    }

    const sessionUrl = String(sessionStorage.getItem('lastEntityBrowserUrl') || '').trim()
    if (isEntityBrowserListUrl(sessionUrl)) {
      if (preferFallbackForPagedFrom && !sessionUrl.includes('?')) {
        return fallback
      }
      return sessionUrl
    }
  } catch {
    // ignore storage access issues
  }

  return fallback
}
