// Renders scene.html to PNG frames (30 fps, 5 s) — then make.sh muxes them with music.wav.
//   node render.js <frames-dir> [stillsDir]
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const [outDir, stillsDir] = process.argv.slice(2);
const FPS = 30, DUR = 5;
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, 'scene.html'));
  await p.evaluate((svg) => window.setLogo(svg), fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8').replace(/width="512" height="512"/, ''));
  await p.evaluate(async () => { await document.fonts.load('900 100px Heebo', 'CubeFinance'); await document.fonts.load('800 60px Heebo', 'עוזרת'); await document.fonts.load('500 30px Heebo', 'זמינה'); await document.fonts.ready; });
  fs.mkdirSync(outDir, { recursive: true });
  const stage = await p.$('#stage');
  for (let f = 0; f < FPS * DUR; f++) {
    await p.evaluate((t) => window.renderAt(t), f / FPS);
    await stage.screenshot({ path: path.join(outDir, String(f).padStart(4, '0') + '.png') });
  }
  if (stillsDir) {
    fs.mkdirSync(stillsDir, { recursive: true });
    for (const [t, n] of [[0.7, '1-title'], [1.72, '2-logo-hit'], [2.7, '3-tagline'], [4.2, '4-final']]) {
      await p.evaluate((t) => window.renderAt(t), t);
      await stage.screenshot({ path: path.join(stillsDir, 'scene-' + n + '.png') });
    }
  }
  await b.close();
})();
