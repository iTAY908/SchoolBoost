// ============================================================================
// Seedance 2.5 video generation via the Kinovi API.
//
// Fixes the fragile parts of a naive shell version:
//   • The API key comes from the environment — never hard-coded, never logged.
//   • Responses are parsed as JSON instead of grepped, so a whitespace change
//     in the API's formatting can't silently break the caller.
//   • Polling has a hard deadline and backs off, so a stuck job can't spin
//     forever; transient network/5xx errors are retried instead of aborting.
//   • The finished video is actually downloaded to disk.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const API_ROOT = process.env.KINOVI_API_ROOT || 'https://kinovi.ai/api/v1';
const DEFAULT_MODEL = 'seedance2-5-preview';

// Values the API accepts. Validating locally turns a wasted round-trip (and a
// possibly billable job) into an immediate, readable error.
const RESOLUTIONS = ['480p', '720p', '1080p'];
const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const DURATION_RANGE = [1, 12];

class SeedanceError extends Error {
  constructor(message, { status, body, code } = {}) {
    super(message);
    this.name = 'SeedanceError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read the key from the environment. Never accept it as a literal in code. */
function getApiKey(explicit) {
  const key = explicit || process.env.KINOVI_API_KEY;
  if (!key) {
    throw new SeedanceError(
      'Missing API key. Set KINOVI_API_KEY in your environment:\n' +
      '  export KINOVI_API_KEY="your-key"\n' +
      'Do not paste the key into source files — anything committed is leaked.',
      { code: 'no_api_key' }
    );
  }
  return key;
}

/** Redact anything key-shaped before it can reach a log. */
function redact(text) {
  return String(text == null ? '' : text).replace(/\b(zimg_|sk-|Bearer\s+)\S+/gi, '$1***');
}

/**
 * fetch with a timeout plus retries for transient failures.
 * 4xx (except 429) fail immediately — retrying a bad request just wastes time.
 */
async function request(url, options = {}, { retries = 3, timeoutMs = 30000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: ac.signal });
      clearTimeout(timer);

      const raw = await res.text();
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

      if (res.ok) return body;

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === retries) {
        throw new SeedanceError(
          `HTTP ${res.status} from ${new URL(url).pathname}: ${redact(raw).slice(0, 300)}`,
          { status: res.status, body }
        );
      }
      // Honour Retry-After when the server sends it.
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      lastErr = new SeedanceError(`HTTP ${res.status}`, { status: res.status, body });
      await sleep(wait);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SeedanceError && err.status && err.status < 500 && err.status !== 429) throw err;
      if (attempt === retries) {
        throw new SeedanceError(
          err.name === 'AbortError'
            ? `Request timed out after ${timeoutMs}ms`
            : `Network error: ${err.message}`,
          { code: 'network' }
        );
      }
      lastErr = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

/** Validate inputs before spending a job on them. */
function validate(inputs) {
  const errors = [];
  if (!inputs.prompt || !String(inputs.prompt).trim()) errors.push('prompt is required');
  if (inputs.duration != null) {
    const d = Number(inputs.duration);
    if (!Number.isFinite(d) || d < DURATION_RANGE[0] || d > DURATION_RANGE[1]) {
      errors.push(`duration must be ${DURATION_RANGE[0]}–${DURATION_RANGE[1]} seconds`);
    }
  }
  if (inputs.resolution && !RESOLUTIONS.includes(inputs.resolution)) {
    errors.push(`resolution must be one of ${RESOLUTIONS.join(', ')}`);
  }
  if (inputs.aspectRatio && !ASPECT_RATIOS.includes(inputs.aspectRatio)) {
    errors.push(`aspectRatio must be one of ${ASPECT_RATIOS.join(', ')}`);
  }
  if (inputs.seed != null && !Number.isInteger(Number(inputs.seed))) {
    errors.push('seed must be an integer');
  }
  if (errors.length) throw new SeedanceError('Invalid inputs:\n  - ' + errors.join('\n  - '), { code: 'invalid_input' });
}

/**
 * Submit a generation job.
 * @returns {Promise<string>} the task id
 */
async function createTask({ apiKey, model = DEFAULT_MODEL, callBackUrl, ...inputs } = {}) {
  const key = getApiKey(apiKey);
  validate(inputs);

  const payload = {
    model,
    inputs: {
      prompt: String(inputs.prompt).trim(),
      ...(inputs.duration != null ? { duration: Number(inputs.duration) } : {}),
      ...(inputs.resolution ? { resolution: inputs.resolution } : {}),
      ...(inputs.aspectRatio ? { aspectRatio: inputs.aspectRatio } : {}),
      ...(inputs.seed != null ? { seed: Number(inputs.seed) } : {}),
      ...(inputs.image ? { image: inputs.image } : {}),          // image-to-video
      ...(inputs.negativePrompt ? { negativePrompt: inputs.negativePrompt } : {}),
    },
    // Only send a callback when one is actually configured. Posting to
    // example.com (as the sample script did) is a no-op at best.
    ...(callBackUrl ? { callBackUrl } : {}),
  };

  const body = await request(`${API_ROOT}/jobs/createTask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });

  const taskId = body?.taskId || body?.data?.taskId || body?.id || body?.data?.id;
  if (!taskId) {
    throw new SeedanceError(
      `No taskId in the response: ${JSON.stringify(body).slice(0, 300)}`,
      { body, code: 'no_task_id' }
    );
  }
  return taskId;
}

/** Fetch the current record for a task. */
async function getTask(taskId, { apiKey } = {}) {
  const key = getApiKey(apiKey);
  return request(`${API_ROOT}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
}

const SUCCESS = new Set(['success', 'succeeded', 'completed', 'complete']);
const FAILURE = new Set(['fail', 'failed', 'error', 'cancelled', 'canceled']);

/** Pull the video URL out of whichever field the API used. */
function extractVideoUrl(record) {
  const d = record?.data || record || {};
  const candidates = [
    d.videoUrl, d.video_url, d.url, d.outputUrl, d.output_url,
    d.resultUrl, d.result_url,
    Array.isArray(d.outputs) ? d.outputs[0]?.url || d.outputs[0] : null,
    Array.isArray(d.results) ? d.results[0]?.url || d.results[0] : null,
    d.result?.videoUrl, d.result?.url,
  ];
  return candidates.find((u) => typeof u === 'string' && /^https?:\/\//.test(u)) || null;
}

/**
 * Poll until the job finishes.
 * Backs off from 2s to 15s and gives up at `timeoutMs` — a job that never
 * settles must not hang the caller forever.
 */
async function waitForTask(taskId, {
  apiKey, timeoutMs = 10 * 60 * 1000, onProgress = () => {},
} = {}) {
  const startedAt = Date.now();
  let delay = 2000;
  let consecutiveErrors = 0;

  for (;;) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new SeedanceError(
        `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for task ${taskId}. ` +
        `The job may still finish — check it later with: recordInfo?taskId=${taskId}`,
        { code: 'timeout' }
      );
    }

    let record;
    try {
      record = await getTask(taskId, { apiKey });
      consecutiveErrors = 0;
    } catch (err) {
      // A blip while polling shouldn't kill a job that's already running.
      if (++consecutiveErrors >= 5) throw err;
      onProgress({ status: 'polling_error', message: err.message, elapsedMs: Date.now() - startedAt });
      await sleep(delay);
      continue;
    }

    const d = record?.data || record || {};
    const status = String(d.status || d.state || '').toLowerCase();
    onProgress({ status, elapsedMs: Date.now() - startedAt, record });

    if (SUCCESS.has(status)) {
      const videoUrl = extractVideoUrl(record);
      if (!videoUrl) {
        throw new SeedanceError(
          `Task reported success but no video URL was found: ${JSON.stringify(record).slice(0, 400)}`,
          { record, code: 'no_video_url' }
        );
      }
      return { taskId, status, videoUrl, record };
    }
    if (FAILURE.has(status)) {
      const reason = d.failReason || d.error || d.message || JSON.stringify(record).slice(0, 300);
      throw new SeedanceError(`Generation failed: ${redact(reason)}`, { record, code: 'generation_failed' });
    }

    await sleep(delay);
    delay = Math.min(delay * 1.4, 15000);   // ease off; don't hammer the API
  }
}

/** Download the finished video to disk. */
async function downloadVideo(videoUrl, outPath) {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const res = await fetch(videoUrl);
  if (!res.ok) throw new SeedanceError(`Download failed: HTTP ${res.status}`, { status: res.status });

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new SeedanceError('Downloaded file is empty', { code: 'empty_download' });
  fs.writeFileSync(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

/**
 * One call: submit → wait → download.
 * @returns {Promise<{taskId, videoUrl, file?: {path, bytes}}>}
 */
async function generateVideo(options = {}) {
  const { output, onProgress = () => {}, timeoutMs, ...rest } = options;
  const taskId = await createTask(rest);
  onProgress({ status: 'submitted', taskId });

  const done = await waitForTask(taskId, { apiKey: rest.apiKey, timeoutMs, onProgress });

  let file = null;
  if (output) {
    onProgress({ status: 'downloading', taskId, videoUrl: done.videoUrl });
    file = await downloadVideo(done.videoUrl, output);
  }
  return { taskId, videoUrl: done.videoUrl, record: done.record, file };
}

module.exports = {
  SeedanceError,
  DEFAULT_MODEL,
  RESOLUTIONS,
  ASPECT_RATIOS,
  DURATION_RANGE,
  createTask,
  getTask,
  waitForTask,
  downloadVideo,
  generateVideo,
  extractVideoUrl,
  validate,
  redact,
};
