#!/usr/bin/env node
const { chromium } = require('playwright');

async function checkHit(page, tab) {
  return page.evaluate((tabId) => {
    const btn = document.querySelector(`[data-member-tab="${tabId}"]`);
    if (!btn) return { tabId, error: 'no button' };
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      tabId,
      btnRect: { left: r.left, top: r.top, width: r.width, height: r.height },
      hit: top ? { tag: top.tagName, id: top.id, className: top.className?.slice?.(0, 80) } : null,
      hitsButton: top === btn || btn.contains(top),
    };
  }, tab);
}

async function main() {
  const browser = await chromium.launch();
  for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'mobile'], [901, 900, 'edge901']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('http://localhost:8000/member-dashboard.html', { waitUntil: 'networkidle' });
    await page.fill('#client-email', 'hello@thegrovearlington.org');
    await page.click('#client-login-form button[type="submit"]');
    await page.waitForSelector('#dashboard-main:not(.hidden)');
    if (w < 901) {
      await page.click('#member-sidebar-toggle');
      await page.waitForTimeout(350);
    }

    console.log('\n' + label + ':');
    const drawerOpen = await page.evaluate(() => document.getElementById('dashboard-main')?.classList.contains('drawer-open'));
    console.log('  drawer-open:', drawerOpen);
    for (const tab of ['overview', 'billing', 'listing', 'profile']) {
      const r = await checkHit(page, tab);
      console.log(' ', tab, r.hitsButton ? 'OK' : 'BLOCKED', r.hit);
    }
    await page.close();
  }
  await browser.close();
}

main().catch(console.error);