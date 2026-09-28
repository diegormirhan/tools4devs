// Renders thumb-1280x640.html to a 1280x640 PNG. Needs playwright-core and a Chromium (adjust executablePath).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--allow-file-access-from-files'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
await pg.goto('file://' + process.cwd() + '/thumb-1280x640.html');
await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
await pg.screenshot({ path: 'tools4devs-thumb-1280x640.png' });
await b.close();
