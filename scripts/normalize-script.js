#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  grok: 'grok-2-latest',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile'
};

const USAGE = 'Usage: normalize-script <inputScriptPath> <outputJsonPath>\nDefault outputJsonPath: ./out/normalized.json';

const inputArg = process.argv[2];
const outputArg = process.argv[3] ?? 'out/normalized.json';

if (!inputArg || inputArg === '--help' || inputArg === '-h') {
  console.error(USAGE);
  process.exit(inputArg ? 0 : 1);
}

const inputPath = resolve(process.cwd(), inputArg);
const outputPath = resolve(process.cwd(), outputArg);
const outputDir = dirname(outputPath);
mkdirSync(outputDir, { recursive: true });

const rawScript = readFileSync(inputPath, 'utf8');
if (!rawScript.trim()) {
  console.error('Input script is empty.');
  process.exit(1);
}

const sourceHash = `sha256:${createHash('sha256').update(rawScript).digest('hex')}`;

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

const prompt = `You are a normalization engine. Convert the input comic script into NormalizedScript v1 JSON.

Rules:
- Output JSON ONLY. No markdown. No commentary.
- Do NOT rewrite any story text. Copy dialogue, narration, captions, crawlers, SFX verbatim.
- Detect pages from headings like "PAGE ONE", "PAGE TWO", etc. Infer page_number accordingly.
- Detect panels from "Panel X" markers.
- Map content into blocks with types: ART_NOTE, NARRATOR, DIALOGUE, CAPTION, SFX, CRAWLER, TITLE_CARD, OTHER.
- For DIALOGUE blocks, set speaker to the character name before the colon.
- If you cannot confidently assign a page/panel boundary, put that content in OTHER and add a warning string to warnings[].
- Produce output that conforms to the provided JSON Schema exactly.

Schema path: schemas/normalized-script.v1.schema.json

Required output skeleton:
{
  "source_hash": "${sourceHash}",
  "warnings": [],
  "pages": [
    {
      "page_number": 1,
      "panels": [
        {
          "panel_number": 1,
          "blocks": [
            {
              "type": "OTHER",
              "text": ""
            }
          ]
        }
      ]
    }
  ]
}`;

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

async function callProvider() {
  switch (provider) {
    case 'gemini': {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nSCRIPT:\n${rawScript}` }] }],
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
          max_tokens: 4000,
          messages: [{ role: 'user', content: `${prompt}\n\nSCRIPT:\n${rawScript}` }],
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
          messages: [{ role: 'user', content: `${prompt}\n\nSCRIPT:\n${rawScript}` }],
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
  console.log(`Using provider: ${provider} (${model})`);
  const text = await callProvider();
  const parsed = JSON.parse(stripMarkdownFences(text));
  parsed.source_hash = sourceHash;

  const tempPath = `${outputPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

  const validation = spawnSync('node', ['scripts/validate-normalized.js', tempPath], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  if (validation.status !== 0) {
    process.stderr.write(validation.stderr || validation.stdout || 'Validation failed\n');
    rmSync(tempPath, { force: true });
    process.exit(1);
  }

  renameSync(tempPath, outputPath);
  process.stdout.write(validation.stdout);
  console.log(`Wrote: ${outputArg}`);
} catch (error) {
  console.error(`normalize-script failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
