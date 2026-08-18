// Minimal HTTP wrapper around the `piper` CLI. No dependencies — pure Node.
// POST /synthesize {"text": "..."} -> {"audio": "<base64 wav>", "sampleRate": N, "durationMs": N}
// GET  /health -> 200

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 5001);
const MODEL_PATH = process.env.PIPER_MODEL_PATH ?? '/app/voices/en_US-lessac-medium.onnx';
const PIPER_TIMEOUT_MS = 30_000;
const MAX_TEXT_LENGTH = 5000;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/** Parses a standard 44-byte WAV header to get sample rate, channels, and duration. */
function parseWavDurationMs(buffer) {
  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataSize = buffer.readUInt32LE(40);
  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationMs = bytesPerSecond > 0 ? Math.round((dataSize / bytesPerSecond) * 1000) : 0;
  return { sampleRate, durationMs };
}

function runPiper(text, outPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('piper', ['--model', MODEL_PATH, '--output_file', outPath], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('piper timed out'));
    }, PIPER_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`piper exited with code ${code}: ${stderr.trim()}`));
      }
    });

    child.stdin.write(text);
    child.stdin.end();
  });
}

async function handleSynthesize(req, res) {
  const body = await readJsonBody(req);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'text is required' }));
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` }));
    return;
  }

  const outPath = `/tmp/piper-${randomUUID()}.wav`;
  try {
    await runPiper(text, outPath);
    const wav = await readFile(outPath);
    const { sampleRate, durationMs } = parseWavDurationMs(wav);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ audio: wav.toString('base64'), sampleRate, durationMs }));
  } finally {
    await unlink(outPath).catch(() => {});
  }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && req.url === '/synthesize') {
    handleSynthesize(req, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'synthesis failed' }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`piper-http listening on :${PORT}`);
});
