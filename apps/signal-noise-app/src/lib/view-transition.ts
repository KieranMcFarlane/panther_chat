type RouterLike = {
  push: (href: string) => void
}

export function pushWithViewTransition(router: RouterLike, href: string): void {
  if (typeof window === 'undefined') {
    router.push(href)
    return
  }

  const documentWithTransition = document as Document & {
    startViewTransition?: (callback: () => void) => { finished?: Promise<unknown> }
  }

  if (typeof documentWithTransition.startViewTransition === 'function') {
    documentWithTransition.startViewTransition(() => {
      router.push(href)
    })
    return
  }

  router.push(href)
}
