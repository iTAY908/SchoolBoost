// Renders a scene to PNG frames (30 fps, 5 s per scene); make.sh muxes them with the music.
//   node render.js <frames-dir> [stills-dir] [scene.html|ai-scene.html] [first-frame-number]
const { chromium } = require(process.env.PW || 'playwright');
const fs = require('fs'), path = require('path');
const [outDir, stillsDir, sceneFile = 'scene.html', firstArg = '0'] = process.argv.slice(2);
const FPS = 30, DUR = 5, FIRST = parseInt(firstArg, 10);
const STILLS = {
  'scene.html': [[0.7, 'scene-5-title'], [1.72, 'scene-6-logo-hit'], [2.7, 'scene-7-tagline'], [4.2, 'scene-8-final']],
  'ai-scene.html': [[1.3, 'scene-1-typing'], [2.25, 'scene-2-thinking'], [3.35, 'scene-3-calculating'], [4.3, 'scene-4-answer']],
};
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.join(__dirname, sceneFile));
  await p.evaluate((svg) => window.setLogo(svg), fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8').replace(/width="512" height="512"/, ''));
  await p.evaluate(async () => {
    await document.fonts.load('900 100px Heebo', 'CubeFinance'); await document.fonts.load('800 60px Heebo', 'עוזרת');
    await document.fonts.load('500 30px Heebo', 'זמינה'); await document.fonts.ready;
  });
  fs.mkdirSync(outDir, { recursive: true });
  const stage = await p.$('#stage');
  for (let f = 0; f < FPS * DUR; f++) {
    await p.evaluate((t) => window.renderAt(t), f / FPS);
    await stage.screenshot({ path: path.join(outDir, String(FIRST + f).padStart(4, '0') + '.png') });
  }
  if (stillsDir) {
    fs.mkdirSync(stillsDir, { recursive: true });
    for (const [t, n] of STILLS[sceneFile] || []) {
      await p.evaluate((t) => window.renderAt(t), t);
      await stage.screenshot({ path: path.join(stillsDir, n + '.png') });
    }
  }
  if (sceneFile === 'ai-scene.html') {
    fs.writeFileSync(path.join(__dirname, 'type-times.json'), JSON.stringify(await p.evaluate(() => window.typeTimes)));
  }
  await b.close();
})();
