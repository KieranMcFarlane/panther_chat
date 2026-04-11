import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

const baseUrl = process.env.SNA_RUNTIME_BASE_URL || 'http://localhost:3005'
const chromePath =
  process.env.SNA_CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

function resolveChromePath() {
  if (existsSync(chromePath)) return chromePath
  throw new Error(`Chrome executable not found at ${chromePath}`)
}

async function waitForModalText(page, needle) {
  await page.waitForFunction(
    (text) => {
      const dialog = document.querySelector('[role="dialog"]')
      return Boolean(dialog && (dialog.textContent || '').includes(text))
    },
    { timeout: 45000 },
    needle,
  )
  return page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent || '')
}

test('dossier badge modal renders the canonical entity browser controls', async () => {
  const puppeteer = await import('puppeteer')
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: resolveChromePath(),
    args: ['--no-sandbox'],
  })
  const browserProcess = browser.process()

  try {
    const page = await browser.newPage()
    page.setDefaultTimeout(30000)

    await page.goto(`${baseUrl}/entity-browser/b61e07d3-b0e5-4d5c-908e-064de77eb955/dossier?from=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForFunction(() => document.body && document.body.innerText.includes('Arsenal'), { timeout: 30000 })

    await page.waitForSelector('[data-testid="league-nav-simple-trigger"]', { visible: true, timeout: 30000 })
    await page.click('[data-testid="league-nav-simple-trigger"]')

    await page.waitForSelector('[role="dialog"]', { timeout: 45000 })
    const modalText = await waitForModalText(page, 'Sort By')
    assert.match(modalText, /Sport/)
    assert.match(modalText, /Country/)
    assert.match(modalText, /Competition/)
    assert.match(modalText, /Role/)
    assert.match(modalText, /Sort By/)
    assert.match(modalText, /Sort Order/)
    assert.match(modalText, /Browsing:/)
    assert.doesNotMatch(modalText, /Entity Type/)
    assert.doesNotMatch(modalText, /Select Sport/)
    assert.doesNotMatch(modalText, /Browsing: All Sports/)
  } finally {
    await browser.disconnect()
    browserProcess?.kill('SIGKILL')
  }
})
