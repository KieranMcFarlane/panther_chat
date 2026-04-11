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

async function loadPageAndCollectText(page, path, waitForText) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(
    (needle) => document.body && document.body.innerText.includes(needle),
    { timeout: 45000 },
    waitForText,
  )
  return page.evaluate(() => document.body.innerText)
}

test('shared filter UX runtime smoke covers opportunities and rfps surfaces', async () => {
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

    const opportunitiesText = await loadPageAndCollectText(page, '/opportunities', 'Canonical context:')
    assert.match(opportunitiesText, /Opportunity Shortlist/)
    assert.match(opportunitiesText, /Canonical context:/)
    assert.match(opportunitiesText, /Add to Pipeline/)
    const opportunitiesComboboxes = await page.$$eval('button[role="combobox"]', (nodes) => nodes.length)
    assert.equal(opportunitiesComboboxes, 6)

    const rfpsText = await loadPageAndCollectText(page, '/rfps', 'Canonical context:')
    assert.match(rfpsText, /Promoted RFP opportunities/)
    assert.match(rfpsText, /Canonical context:/)
    assert.doesNotMatch(rfpsText, /label: 'Theme'/)
    const rfpsComboboxes = await page.$$eval('button[role="combobox"]', (nodes) => nodes.length)
    assert.equal(rfpsComboboxes, 4)
  } finally {
    await browser.disconnect()
    browserProcess?.kill('SIGKILL')
  }
})
