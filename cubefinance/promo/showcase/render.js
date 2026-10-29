// Renders scene.html to PNG frames (30 fps, 30 s), or stills at given times.
//   node render.js frames <dir>          → <dir>/0000.png … 0899.png
//   node render.js stills <dir> t1 t2 …  → <dir>/still-<t>.png
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const [mode, outDir, ...times] = process.argv.slice(2);
const FPS = 30, DUR = 30;
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'scene.html'));
  await p.evaluate((svg) => window.setLogo(svg), fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8').replace(/width="512" height="512"/, ''));
  await p.evaluate(async () => {
    await document.fonts.load('900 96px Heebo', 'הכסף CubeFinance'); await document.fonts.load('500 40px Heebo', 'הכנסות');
    await document.fonts.load('800 60px Heebo', 'זמינה'); await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {})));
  });
  fs.mkdirSync(outDir, { recursive: true });
  const stage = await p.$('#stage');
  const list = mode === 'stills' ? times.map(Number) : Array.from({ length: FPS * DUR }, (_, f) => f / FPS);
  for (let i = 0; i < list.length; i++) {
    await p.evaluate((t) => window.renderAt(t), list[i]);
    const name = mode === 'stills' ? 'still-' + list[i] + '.png' : String(i).padStart(4, '0') + '.png';
    await stage.screenshot({ path: path.join(outDir, name) });
  }
  if (errs.length) console.error('page errors:', errs);
  await b.close();
})();
