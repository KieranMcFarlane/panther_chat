const puppeteer = require('puppeteer');

async function clickByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate(el => (el.textContent || '').trim(), h);
    if (t === text || t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

async function firstByText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await page.evaluate(el => (el.textContent || '').trim(), h);
    if (t === text || t.includes(text)) return h;
  }
  return null;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(35000);
  const results = [];

  async function snap(label) {
    return {
      label,
      url: page.url(),
      title: await page.title(),
      pageLabel: await page.evaluate(() => {
        const text = document.body?.innerText || '';
        const m = text.match(/Page\s+\d+\s+of\s+\d+/i);
        return m ? m[0] : null;
      }),
    };
  }

  async function run(name, fn) {
    try {
      await fn();
      results.push({ name, status: 'PASS', state: await snap('after') });
    } catch (e) {
      results.push({ name, status: 'FAIL', error: String(e.message || e), state: await snap('after-fail') });
    }
  }

  await run('J1 Entity Browser load', async () => {
    await page.goto('http://localhost:3005/entity-browser', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1');
  });

  await run('J2 Pagination next/back preserves page state', async () => {
    const clicked = await clickByText(page, 'button', 'Next');
    if (!clicked) throw new Error('Next button not found');
    await page.waitForFunction(() => (document.body?.innerText || '').includes('Page 2 of'), { timeout: 30000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (document.body?.innerText || '').includes('Page 1 of'), { timeout: 30000 });
  });

  await run('J3 Search + Apply Filters updates URL/results scope', async () => {
    await page.waitForSelector('input[placeholder="Search entities..."]');
    await page.click('input[placeholder="Search entities..."]', { clickCount: 3 });
    await page.type('input[placeholder="Search entities..."]', 'Rajasthan');
    const applied = await clickByText(page, 'button', 'Apply Filters');
    if (!applied) throw new Error('Apply Filters button not found');
    await page.waitForFunction(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('search') || '').toLowerCase() === 'rajasthan';
    }, { timeout: 45000 });
  });

  await run('J4 View Full Profile opens entity profile route', async () => {
    await page.waitForSelector('[data-testid="view-full-profile"]', { timeout: 45000 });
    const btn = await page.$('[data-testid="view-full-profile"]');
    if (!btn) throw new Error('No View Full Profile button found');
    await btn.click();
    await page.waitForFunction(() => location.pathname.startsWith('/entity/'), { timeout: 30000 });
  });

  await run('J5 Browser back returns to entity browser with prior search context', async () => {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => location.pathname === '/entity-browser', { timeout: 30000 });
    await page.waitForFunction(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get('search') || '').toLowerCase() === 'rajasthan';
    }, { timeout: 45000 });
  });

  await run('J6 Dossier back button returns to page=2 context', async () => {
    await page.goto('http://localhost:3005/entity-browser/77/dossier?from=2', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="back-to-entity-browser"]', { timeout: 45000 });
    const backBtn = await page.$('[data-testid="back-to-entity-browser"]');
    if (!backBtn) throw new Error('Back to Entity Browser button not found');
    await backBtn.click();
    await page.waitForFunction(() => location.pathname === '/entity-browser', { timeout: 45000 });
    await page.waitForFunction(() => {
      const params = new URLSearchParams(window.location.search);
      const pageFromQuery = params.get('page');
      const text = document.body?.innerText || '';
      return pageFromQuery === '2' || text.includes('Page 2 of');
    }, { timeout: 45000 });
  });

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
