const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const svg = require('fs').readFileSync(process.argv[2], 'utf8');
  for (const [s, out] of process.argv.slice(3).map(x => x.split(':'))) {
    const p = await b.newPage({ viewport: { width: +s, height: +s } });
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${s}" height="${s}"`)}</body></html>`);
    await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: +s, height: +s } });
  }
  await b.close();
})();
