/**
 * PR #48 delete regression against a running Vite/preview server.
 * Usage: node scripts/editor-delete-regression.mjs [baseUrl]
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const baseUrl = process.argv[2] || 'http://127.0.0.1:3010/';
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

async function loadPuppeteer() {
  try {
    return require('puppeteer');
  } catch {
    const { execSync } = await import('child_process');
    execSync('npm install --no-save --no-package-lock puppeteer@24', {
      stdio: 'inherit',
      cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
    });
    return require('puppeteer');
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function openEditor(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  const clicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button, a, [role="button"]')];
    const label = b =>
      `${b.textContent || ''} ${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`;
    const hit =
      buttons.find(b => /edytor graficzny|graphic ui|visual editor/i.test(label(b))) ||
      buttons.find(b => /edytor ui|edytor/i.test(label(b)));
    if (!hit) return false;
    hit.click();
    return true;
  });
  if (!clicked) throw new Error('Edytor Graficzny UI nav button not found');
  await page.waitForFunction(
    () =>
      /Właściwości|Properties|Paleta|Palette/i.test(document.body.innerText),
    { timeout: 15000 },
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function widgetCount(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[tabindex="-1"].select-none');
    if (!stage) return -1;
    // Widgets are absolute children of the black viewport
    const viewport = stage.querySelector('.relative.bg-black');
    if (!viewport) return -1;
    return [...viewport.children].filter(el => el.classList.contains('absolute') && el.classList.contains('cursor-move')).length;
  });
}

async function firstWidgetBox(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[tabindex="-1"].select-none');
    const viewport = stage?.querySelector('.relative.bg-black');
    const widget = [...(viewport?.children || [])].find(
      el => el.classList.contains('absolute') && el.classList.contains('cursor-move'),
    );
    if (!widget) return null;
    const r = widget.getBoundingClientRect();
    return { x: r.left + Math.min(8, r.width / 2), y: r.top + Math.min(8, r.height / 2) };
  });
}

async function selectFirstWidget(page) {
  const box = await firstWidgetBox(page);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await sleep(100);
  return true;
}

async function selectionVisible(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const hasProps = /Właściwości Elementu|Widget properties/i.test(text);
    const emptyHint = /Zaznacz lub przeciągnij element/i.test(text);
    return { hasProps, emptyHint, selected: hasProps && !emptyHint };
  });
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, name), fullPage: false });
}

const results = [];

async function runCase(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true, note: 'PASS' });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, note: String(err.message || err) });
    console.error(`FAIL  ${name}: ${err.message || err}`);
  }
}

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();

try {
  await openEditor(page);
  await shot(page, 'editor-delete-00-open.png');
  const initial = await widgetCount(page);
  assert(initial > 0, `expected widgets on canvas, got ${initial}`);

  await runCase('1 select sticks', async () => {
    assert(await selectFirstWidget(page), 'no widget to select');
    await sleep(200);
    const sel = await selectionVisible(page);
    assert(sel.selected, `selection did not stick: ${JSON.stringify(sel)}`);
    await shot(page, 'editor-delete-01-select.png');
  });

  await runCase('2 toolbar trash', async () => {
    const before = await widgetCount(page);
    assert(await selectFirstWidget(page), 'no widget');
    await sleep(150);
    // Click first visible trash that is for widget (aria-label)
    const clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const trash = btns.find(b => /usuń element|delete widget|delete/i.test(b.getAttribute('aria-label') || b.getAttribute('title') || ''));
      if (!trash) return false;
      trash.click();
      return true;
    });
    assert(clicked, 'trash button not found');
    await sleep(200);
    const after = await widgetCount(page);
    assert(after === before - 1, `trash: expected ${before - 1}, got ${after}`);
    await shot(page, 'editor-delete-02-trash.png');
  });

  await runCase('3 Delete key', async () => {
    const before = await widgetCount(page);
    assert(await selectFirstWidget(page), 'no widget');
    await sleep(100);
    // Focus canvas stage
    await page.evaluate(() => {
      const stage = document.querySelector('[tabindex="-1"].select-none');
      stage?.focus();
    });
    await page.keyboard.press('Delete');
    await sleep(200);
    const after = await widgetCount(page);
    assert(after === before - 1, `Delete: expected ${before - 1}, got ${after}`);
    await shot(page, 'editor-delete-03-delete-key.png');
  });

  await runCase('4 Backspace key', async () => {
    const before = await widgetCount(page);
    assert(await selectFirstWidget(page), 'no widget');
    await sleep(100);
    await page.evaluate(() => {
      document.querySelector('[tabindex="-1"].select-none')?.focus();
    });
    await page.keyboard.press('Backspace');
    await sleep(200);
    const after = await widgetCount(page);
    assert(after === before - 1, `Backspace: expected ${before - 1}, got ${after}`);
    await shot(page, 'editor-delete-04-backspace.png');
  });

  await runCase('5 context menu delete', async () => {
    // Preset screen starts with few widgets; prior cases may have nearly emptied it.
    // Drop a fresh label from the palette so the menu target is unambiguous.
    const added = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const labelBtn = btns.find(b =>
        /etykieta|label|tekst|text/i.test(`${b.textContent || ''} ${b.title || ''}`),
      );
      if (!labelBtn) return false;
      labelBtn.click();
      return true;
    });
    await sleep(300);
    const before = await widgetCount(page);
    assert(before > 0, `need a widget for context menu (added=${added})`);
    const box = await firstWidgetBox(page);
    assert(box, 'widget rect missing');
    await page.mouse.click(box.x, box.y, { button: 'right' });
    await sleep(400);
    const menuClicked = await page.evaluate(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find(b =>
        /usu.? element|delete element|delete widget/i.test(b.textContent || ''),
      );
      if (!item) {
        return `none; menus=${document.querySelectorAll('[role="menu"]').length}`;
      }
      item.click();
      return 'ok';
    });
    assert(menuClicked === 'ok', `context menu item not found (${menuClicked})`);
    await sleep(200);
    const after = await widgetCount(page);
    assert(after === before - 1, `context menu: expected ${before - 1}, got ${after}`);
    await shot(page, 'editor-delete-05-context.png');
  });

  await runCase('6 background click clears selection', async () => {
    assert(await selectFirstWidget(page), 'no widget');
    await sleep(100);
    let sel = await selectionVisible(page);
    assert(sel.selected, 'precondition: selected');
    await page.evaluate(() => {
      const stage = document.querySelector('[tabindex="-1"].select-none');
      const viewport = stage?.querySelector('.relative.bg-black');
      viewport?.click();
    });
    await sleep(150);
    sel = await selectionVisible(page);
    assert(sel.emptyHint || !sel.selected, `selection should clear: ${JSON.stringify(sel)}`);
    await shot(page, 'editor-delete-06-background.png');
  });

  await runCase('7 text field focus keeps caret (Backspace/Delete)', async () => {
    const before = await widgetCount(page);
    assert(await selectFirstWidget(page), 'no widget');
    await sleep(150);
    // Prefer type=text label field in inspector
    const focused = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type="text"]')];
      const label = inputs.find(i => i.offsetParent !== null);
      if (!label) return false;
      label.focus();
      label.select();
      return true;
    });
    assert(focused, 'no visible type=text input in inspector');
    await page.keyboard.type('Z');
    await page.keyboard.press('Backspace');
    await sleep(100);
    let after = await widgetCount(page);
    assert(after === before, `Backspace in text field deleted widget (${before}→${after})`);
    await page.keyboard.press('Delete');
    await sleep(100);
    after = await widgetCount(page);
    assert(after === before, `Delete in text field deleted widget (${before}→${after})`);
    await shot(page, 'editor-delete-07-text-focus.png');
  });
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}\t${r.name}\t${r.note}`);
}
if (failed.length) {
  process.exitCode = 1;
} else {
  console.log(`All ${results.length} cases passed. Screenshots → ${outDir}`);
}
