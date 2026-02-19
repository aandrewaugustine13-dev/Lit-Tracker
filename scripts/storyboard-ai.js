#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile'
};

const inputArg = process.argv[2] ?? 'out/normalized.json';
const outputArg = process.argv[3] ?? 'out/parsed/storyboard.v2.json';
const cwd = process.cwd();
const inputPath = resolve(cwd, inputArg);
const outputPath = resolve(cwd, outputArg);
mkdirSync(dirname(outputPath), { recursive: true });

const providerEnvOrder = [
  ['gemini', 'GEMINI_API_KEY'],
  ['anthropic', 'ANTHROPIC_API_KEY'],
  ['openai', 'OPENAI_API_KEY'],
  ['groq', 'GROQ_API_KEY'],
  ['grok', 'GROK_API_KEY'],
  ['deepseek', 'DEEPSEEK_API_KEY']
];

const configured = providerEnvOrder.find(([, key]) => Boolean(process.env[key]?.trim()));
if (!configured) {
  console.error('No BYOK API key found. Set one of: GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GROQ_API_KEY, GROK_API_KEY, DEEPSEEK_API_KEY.');
  process.exit(1);
}

const [provider, keyName] = configured;
const apiKey = process.env[keyName].trim();
const model = DEFAULT_MODELS[provider];

const SYSTEM_PROMPT = `You are a storyboard compiler.

INPUT:
- manifest: a list of (page,panel) pairs that MUST be covered.
- panels: panel data with blocks. Each block has block_id, type, speaker(optional), and text.

OUTPUT:
Return JSON ONLY matching the schema.

Hard requirements:
1) For EVERY (page,panel) in manifest, output one entry in ink[].
2) For EVERY (page,panel) in manifest, output one entry in proof[].
3) Include manifest[] in output and keep entries exactly from input manifest.
4) Each ink item MUST include evidence[] with at least 1 real block_id from that panel.
5) evidence.snippet must be <= 12 words copied verbatim from that block's text.
6) Do not invent events. Use only provided blocks.
7) If a panel has little content, keep beat conservative, tone OTHER, and still provide evidence.
8) If panel has no clear content, use beat="(no content)" and tone OTHER.`;

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function countWords(text) {
  return (String(text).trim().match(/\S+/g) || []).length;
}

function ensureBlockIds(normalized) {
  for (const page of normalized.pages || []) {
    for (const panel of page.panels || []) {
      panel.blocks = (panel.blocks || []).map((block, index) => ({
        ...block,
        block_id: block.block_id || `p${page.page_number}-pa${panel.panel_number}-b${index}`
      }));
    }
  }
}

function compactText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function setFromPairs(items, pageKey = 'page', panelKey = 'panel') {
  return new Set((items || []).map((x) => `${x[pageKey]}:${x[panelKey]}`));
}

async function callProvider(promptText) {
  switch (provider) {
    case 'gemini': {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.1 }
        })
      });
      if (!r.ok) throw new Error(`Gemini API error ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }
    case 'anthropic': {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 7000,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.1
        })
      });
      if (!r.ok) throw new Error(`Anthropic API error ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.content?.[0]?.text ?? '';
    }
    case 'openai':
    case 'groq':
    case 'grok':
    case 'deepseek': {
      const endpoints = {
        openai: 'https://api.openai.com/v1/chat/completions',
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        grok: 'https://api.x.ai/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/v1/chat/completions'
      };
      const r = await fetch(endpoints[provider], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.1
        })
      });
      if (!r.ok) throw new Error(`${provider} API error ${r.status}: ${await r.text()}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content ?? '';
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

try {
  const normalized = parseJson(inputPath);
  ensureBlockIds(normalized);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const normalizedSchema = parseJson(resolve(cwd, 'schemas/normalized-script.v1.schema.json'));
  const batchSchema = parseJson(resolve(cwd, 'schemas/storyboard.batch.v1.schema.json'));
  const validateNormalized = ajv.compile(normalizedSchema);
  const validateBatch = ajv.compile(batchSchema);

  if (!validateNormalized(normalized)) {
    const errs = (validateNormalized.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`Input normalized JSON invalid:\n${errs}`);
  }

  const manifest = [];
  const panels = [];
  const panelMap = new Map();

  for (const page of normalized.pages) {
    for (const panel of page.panels) {
      manifest.push({ page: page.page_number, panel: panel.panel_number });
      const blocks = panel.blocks.map((b) => ({
        block_id: b.block_id,
        type: b.type,
        ...(b.speaker ? { speaker: b.speaker } : {}),
        text: compactText(b.text)
      }));
      panels.push({ page: page.page_number, panel: panel.panel_number, blocks });
      panelMap.set(`${page.page_number}:${panel.panel_number}`, panel.blocks);
    }
  }

  const expectedPages = normalized.pages.length;
  const expectedPanels = manifest.length;
  console.log(`expected_pages=${expectedPages}`);
  console.log(`expected_panels=${expectedPanels}`);

  const payload = { manifest, panels };
  const prompt = `${SYSTEM_PROMPT}\n\nINPUT_JSON:\n${JSON.stringify(payload)}`;
  const responseText = await callProvider(prompt);
  const output = JSON.parse(stripMarkdownFences(responseText));

  if (!validateBatch(output)) {
    const errs = (validateBatch.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`storyboard batch output invalid:\n${errs}`);
  }

  const actualPages = new Set((output.ink || []).map((x) => x.page)).size;
  const actualPanels = (output.ink || []).length;
  const actualProof = (output.proof || []).length;
  console.log(`actual_pages=${actualPages}`);
  console.log(`actual_panels=${actualPanels}`);
  console.log(`actual_proof=${actualProof}`);

  if (expectedPages > 1 && actualPages === 1) {
    throw new Error(`Suspicious collapse: expected_pages=${expectedPages}, actual_pages=${actualPages}`);
  }
  if (expectedPanels > 1 && actualPanels === 1) {
    throw new Error(`Suspicious collapse: expected_panels=${expectedPanels}, actual_panels=${actualPanels}`);
  }
  if (expectedPanels > 1 && actualProof === 1) {
    throw new Error(`Suspicious collapse: expected_panels=${expectedPanels}, actual_proof=${actualProof}`);
  }

  const manifestSet = setFromPairs(manifest);
  const outputManifestSet = setFromPairs(output.manifest || []);
  const inkSet = setFromPairs(output.ink || []);
  const proofSet = setFromPairs(output.proof || []);

  const missingManifestEcho = Array.from(manifestSet).filter((k) => !outputManifestSet.has(k));
  const missingInk = Array.from(manifestSet).filter((k) => !inkSet.has(k));
  const missingProof = Array.from(manifestSet).filter((k) => !proofSet.has(k));

  if (missingManifestEcho.length || missingInk.length || missingProof.length) {
    throw new Error([
      missingManifestEcho.length ? `Missing manifest echo: ${missingManifestEcho.join(', ')}` : null,
      missingInk.length ? `Missing ink entries: ${missingInk.join(', ')}` : null,
      missingProof.length ? `Missing proof entries: ${missingProof.join(', ')}` : null
    ].filter(Boolean).join(' | '));
  }

  for (const ink of output.ink) {
    const key = `${ink.page}:${ink.panel}`;
    const blocks = panelMap.get(key) || [];
    if (!Array.isArray(ink.evidence) || ink.evidence.length === 0) {
      throw new Error(`ink ${key} missing evidence`);
    }
    for (const ev of ink.evidence) {
      const source = blocks.find((b) => b.block_id === ev.block_id);
      if (!source) throw new Error(`ink ${key} references unknown block_id ${ev.block_id}`);
      if (countWords(ev.snippet) > 12) throw new Error(`ink ${key} snippet > 12 words`);
      if (!String(source.text).includes(String(ev.snippet))) {
        throw new Error(`ink ${key} snippet not verbatim from ${ev.block_id}`);
      }
    }
  }

  const tempPath = `${outputPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  renameSync(tempPath, outputPath);
  console.log(`Wrote: ${outputPath}`);
} catch (error) {
  rmSync(`${outputPath}.tmp`, { force: true });
  console.error(`storyboard-ai failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
