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
1) For EVERY (page,panel) in manifest, output a corresponding panel entry in pages[].panels[].
2) Also output coverage[] containing EVERY manifest pair with status "ok" or "missing".
3) Each panel MUST include evidence[] with at least 1 item referencing a real block_id from that panel.
4) evidence.snippet must be <= 12 words copied verbatim from that block's text.
5) Do not invent story events. Use only what is in the blocks.

If a panel has little content, still output it with tone OTHER and a conservative beat.`;

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function countWords(text) {
  return (String(text).trim().match(/\S+/g) || []).length;
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

function validateGrounding(output, panelMap) {
  for (const page of output.pages) {
    for (const panel of page.panels) {
      const key = `${page.page_number}:${panel.panel_number}`;
      const blocks = panelMap.get(key) || [];
      if (!Array.isArray(panel.evidence) || panel.evidence.length === 0) {
        throw new Error(`Panel ${key} missing evidence`);
      }
      for (const ev of panel.evidence) {
        const source = blocks.find((b) => b.block_id === ev.block_id);
        if (!source) throw new Error(`Panel ${key} references unknown block_id ${ev.block_id}`);
        if (countWords(ev.snippet) > 12) throw new Error(`Panel ${key} snippet > 12 words`);
        if (!String(source.text).includes(String(ev.snippet))) {
          throw new Error(`Panel ${key} snippet not verbatim in block ${ev.block_id}`);
        }
      }
    }
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

  const payload = { manifest, panels };
  const prompt = `${SYSTEM_PROMPT}\n\nINPUT_JSON:\n${JSON.stringify(payload)}`;

  const responseText = await callProvider(prompt);
  const output = JSON.parse(stripMarkdownFences(responseText));

  if (!validateBatch(output)) {
    const errs = (validateBatch.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`storyboard batch output invalid:\n${errs}`);
  }

  validateGrounding(output, panelMap);

  if (output.coverage.length !== manifest.length) {
    throw new Error(`coverage length ${output.coverage.length} does not match manifest length ${manifest.length}`);
  }

  const manifestSet = new Set(manifest.map((m) => `${m.page}:${m.panel}`));
  const coverageSet = new Set(output.coverage.map((c) => `${c.page}:${c.panel}`));
  const panelSet = new Set();
  for (const p of output.pages) {
    for (const panel of p.panels) panelSet.add(`${p.page_number}:${panel.panel_number}`);
  }

  const missingCoverage = Array.from(manifestSet).filter((k) => !coverageSet.has(k));
  const missingPanels = Array.from(manifestSet).filter((k) => !panelSet.has(k));
  if (missingCoverage.length || missingPanels.length) {
    const warnings = [];
    if (missingCoverage.length) warnings.push(`Missing coverage entries: ${missingCoverage.join(', ')}`);
    if (missingPanels.length) warnings.push(`Missing panel outputs: ${missingPanels.join(', ')}`);
    throw new Error(warnings.join(' | '));
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
