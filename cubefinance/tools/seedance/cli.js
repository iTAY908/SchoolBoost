#!/usr/bin/env node
// ============================================================================
// Seedance 2.5 video generator — command line.
//
//   export KINOVI_API_KEY="your-key"
//   node cli.js --prompt "a cinematic shot of ..." --out out/clip.mp4
//
// Run with --help for every flag.
// ============================================================================

'use strict';

const path = require('path');
const {
  generateVideo, getTask, downloadVideo, extractVideoUrl,
  SeedanceError, RESOLUTIONS, ASPECT_RATIOS, DEFAULT_MODEL,
} = require('./seedance');

const HELP = `
Seedance 2.5 video generator (Kinovi API)

USAGE
  node cli.js --prompt "<text>" [options]
  node cli.js --status <taskId>            check an existing job
  node cli.js --batch prompts.json         generate several clips in sequence

OPTIONS
  --prompt, -p <text>     what to generate                        (required)
  --out, -o <file>        save the video here      (default: out/<taskId>.mp4)
  --duration, -d <sec>    clip length                             (default: 5)
  --resolution, -r <res>  ${RESOLUTIONS.join(' | ')}            (default: 720p)
  --aspect, -a <ratio>    ${ASPECT_RATIOS.join(' | ')}
  --seed <int>            fixed seed, for reproducible output
  --negative <text>       things to avoid
  --image <url>           source image (image-to-video)
  --model <name>          default: ${DEFAULT_MODEL}
  --callback <url>        webhook to notify on completion
  --timeout <sec>         give up waiting after this      (default: 600)
  --no-download           print the URL, don't save the file
  --json                  machine-readable output
  --help, -h              this text

ENVIRONMENT
  KINOVI_API_KEY          required. Never hard-code the key in a script —
                          anything committed to git is effectively public.

EXAMPLES
  node cli.js -p "cinematic tracking shot through a city park after rain" \\
              -d 5 -r 720p -a 16:9 --seed 42 -o out/park.mp4

  node cli.js -p "ice cube dissolving into coins, dark navy background" \\
              -a 9:16 -o out/promo-vertical.mp4
`;

function parseArgs(argv) {
  const args = { };
  const alias = { p: 'prompt', o: 'out', d: 'duration', r: 'resolution', a: 'aspect', h: 'help' };
  for (let i = 0; i < argv.length; i++) {
    let key = argv[i];
    if (!key.startsWith('-')) { (args._ ||= []).push(key); continue; }
    key = key.replace(/^--?/, '');
    if (alias[key]) key = alias[key];
    if (key === 'help' || key === 'json' || key === 'no-download') { args[key] = true; continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { args[key] = true; continue; }
    args[key] = next; i++;
  }
  return args;
}

const fmtBytes = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');
const fmtSec = (ms) => (ms / 1000).toFixed(0) + 's';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const json = !!args.json;
  const log = (...a) => { if (!json) console.log(...a); };

  if (args.help || (!args.prompt && !args.status && !args.batch)) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  // ---- check an existing job ----
  if (args.status) {
    const record = await getTask(args.status);
    const url = extractVideoUrl(record);
    if (json) { console.log(JSON.stringify({ taskId: args.status, videoUrl: url, record }, null, 2)); return; }
    const d = record?.data || record || {};
    log(`Task   : ${args.status}`);
    log(`Status : ${d.status || d.state || 'unknown'}`);
    if (url) {
      log(`Video  : ${url}`);
      if (args.out) {
        const f = await downloadVideo(url, args.out);
        log(`Saved  : ${f.path} (${fmtBytes(f.bytes)})`);
      }
    }
    return;
  }

  // ---- batch: a JSON array of prompt objects ----
  if (args.batch) {
    const jobs = JSON.parse(require('fs').readFileSync(args.batch, 'utf8'));
    if (!Array.isArray(jobs)) throw new Error('batch file must contain a JSON array');
    const results = [];
    for (const [i, job] of jobs.entries()) {
      log(`\n[${i + 1}/${jobs.length}] ${String(job.prompt).slice(0, 60)}…`);
      try {
        const out = job.out || path.join('out', `clip-${String(i + 1).padStart(2, '0')}.mp4`);
        const r = await generateVideo({ ...job, output: args['no-download'] ? null : out, onProgress: progress(log) });
        log(`  ✓ ${r.file ? r.file.path : r.videoUrl}`);
        results.push({ ok: true, ...r });
      } catch (err) {
        log(`  ✗ ${err.message}`);
        results.push({ ok: false, error: err.message, prompt: job.prompt });
      }
    }
    if (json) console.log(JSON.stringify(results, null, 2));
    const failed = results.filter((r) => !r.ok).length;
    log(`\n${results.length - failed}/${results.length} generated`);
    if (failed) process.exitCode = 1;
    return;
  }

  // ---- single generation ----
  const opts = {
    prompt: args.prompt,
    duration: args.duration ? Number(args.duration) : 5,
    resolution: args.resolution || '720p',
    aspectRatio: args.aspect || '16:9',
    ...(args.seed != null ? { seed: Number(args.seed) } : {}),
    ...(args.negative ? { negativePrompt: args.negative } : {}),
    ...(args.image ? { image: args.image } : {}),
    ...(args.model ? { model: args.model } : {}),
    ...(args.callback ? { callBackUrl: args.callback } : {}),
    timeoutMs: (Number(args.timeout) || 600) * 1000,
  };

  log(`Prompt : ${opts.prompt}`);
  log(`Format : ${opts.duration}s · ${opts.resolution} · ${opts.aspectRatio}${opts.seed != null ? ` · seed ${opts.seed}` : ''}`);
  log('');

  let outPath = args.out;
  const result = await generateVideo({
    ...opts,
    output: args['no-download'] ? null : (outPath || null),
    onProgress: progress(log, (taskId) => {
      if (!outPath && !args['no-download']) outPath = path.join('out', `${taskId}.mp4`);
    }),
  });

  // If no --out was given we only learn the taskId after submitting, so the
  // download happens here rather than inside generateVideo.
  let file = result.file;
  if (!file && !args['no-download']) {
    file = await downloadVideo(result.videoUrl, outPath || path.join('out', `${result.taskId}.mp4`));
  }

  if (json) {
    console.log(JSON.stringify({ taskId: result.taskId, videoUrl: result.videoUrl, file }, null, 2));
  } else {
    log('');
    log(`✓ Done`);
    log(`  Task  : ${result.taskId}`);
    log(`  Video : ${result.videoUrl}`);
    if (file) log(`  Saved : ${file.path} (${fmtBytes(file.bytes)})`);
  }
}

function progress(log, onSubmit) {
  let last = '';
  return (p) => {
    if (p.status === 'submitted') { log(`→ Submitted: ${p.taskId}`); onSubmit?.(p.taskId); return; }
    if (p.status === 'downloading') { log(`→ Downloading…`); return; }
    if (p.status === 'polling_error') { log(`  ! ${p.message} (retrying)`); return; }
    const line = `  ${p.status} … ${fmtSec(p.elapsedMs)}`;
    if (line !== last) { log(line); last = line; }
  };
}

main().catch((err) => {
  if (err instanceof SeedanceError) {
    console.error(`\n✗ ${err.message}`);
    if (err.code === 'no_api_key') process.exitCode = 78; else process.exitCode = 1;
  } else {
    console.error(`\n✗ Unexpected error: ${err.message}`);
    process.exitCode = 1;
  }
});
