#!/usr/bin/env node
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch();
  const mobile = process.argv.includes('--mobile');
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://localhost:8000/member-dashboard.html', { waitUntil: 'networkidle' });

  await page.fill('#client-email', 'hello@thegrovearlington.org');
  await page.click('#client-login-form button[type="submit"]');
  await page.waitForSelector('#dashboard-main:not(.hidden)', { timeout: 10000 });

  const tabs = [
    ['overview', 0], ['listing', 3], ['leads', 4], ['training', 2], ['billing', 1],
    ['analytics', 13], ['profile', 5], ['messages', 6], ['notifications', 10],
    ['reviews', 11], ['claims', 12], ['media', 7], ['saved', 8], ['support', 9],
  ];

  let pass = 0;
  let fail = 0;

  if (mobile) {
    const drawerVisible = await page.locator('#member-sidebar').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.width > 0;
    });
    if (!drawerVisible) {
      await page.click('#member-sidebar-toggle');
      await page.waitForTimeout(300);
    }
  }

  for (const [tab, idx] of tabs) {
    if (mobile) await page.click('#member-sidebar-toggle').catch(() => {});
    await page.waitForTimeout(100);
    const btn = page.locator(`[data-member-tab="${tab}"]`);
    await btn.click({ force: true });
    await page.waitForTimeout(150);
    const visible = await page.locator(`#member-tab-${idx}`).evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && !el.classList.contains('hidden');
    });
    const active = await page.locator(`[data-member-tab="${tab}"]`).evaluate((el) => el.classList.contains('active'));
    if (visible && active) {
      console.log('  ✓', tab);
      pass++;
    } else {
      console.log('  ✗', tab, { visible, active });
      fail++;
    }
  }

  console.log('\nJS errors:', errors.length ? errors : 'none');
  console.log(`PASS: ${pass} FAIL: ${fail}`);
  await browser.close();
  process.exit(fail > 0 || errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });