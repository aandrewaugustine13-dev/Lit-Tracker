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

const SYSTEM_PROMPT = `You are a storyboard assistant.

You will receive NormalizedScript v1 JSON for ONE PAGE at a time.
Create Storyboard v2 JSON for that page ONLY.

Rules:
- Output JSON only. No markdown. No commentary.
- Do NOT invent anything not present in the input blocks.
- For each panel:
  - Write shot (if artist note implies framing like wide/close/establishing; else empty string).
  - Write beat as 1 sentence describing the change/action.
  - Write focus as a short phrase of what the reader should notice.
  - Write dialogue_intent as a short phrase describing what the dialogue is doing.
  - Choose tone from: SETUP, TENSION, HORROR, SATIRE, ACTION, REVEAL, AFTERMATH, OTHER.
  - Provide evidence[] with at least 1 referenced block from that panel:
      * block_type must match the input block type
      * block_index is the index in the panel.blocks[] array
      * text_snippet is <= 12 words copied verbatim from the block text
- If uncertain, keep beat conservative and tone OTHER.

Return an object:
{ "page_number": <int>, "panels": [...], "page_summary": <string> }`;

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function stripMarkdownFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function countWords(text) {
  return (String(text).trim().match(/\S+/g) || []).length;
}

function validatePageGrounding(pageOutput, inputPage) {
  if (!Array.isArray(pageOutput.panels)) throw new Error('panels must be an array');
  for (const panelOutput of pageOutput.panels) {
    const sourcePanel = inputPage.panels.find((p) => p.panel_number === panelOutput.panel_number);
    if (!sourcePanel) throw new Error(`panel_number ${panelOutput.panel_number} not found in input page`);
    if (!Array.isArray(panelOutput.evidence) || panelOutput.evidence.length < 1) {
      throw new Error(`panel ${panelOutput.panel_number} missing evidence`);
    }
    for (const ev of panelOutput.evidence) {
      if (ev.block_index < 0 || ev.block_index >= sourcePanel.blocks.length) {
        throw new Error(`panel ${panelOutput.panel_number} evidence block_index out of range`);
      }
      const sourceBlock = sourcePanel.blocks[ev.block_index];
      if (sourceBlock.type !== ev.block_type) {
        throw new Error(`panel ${panelOutput.panel_number} evidence block_type mismatch`);
      }
      if (countWords(ev.text_snippet) > 12) {
        throw new Error(`panel ${panelOutput.panel_number} text_snippet exceeds 12 words`);
      }
      if (!String(sourceBlock.text).includes(String(ev.text_snippet))) {
        throw new Error(`panel ${panelOutput.panel_number} text_snippet must be verbatim from source block`);
      }
    }
  }
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
          max_tokens: 3000,
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
  const normalizedSchema = parseJson(resolve(cwd, 'schemas/normalized-script.v1.schema.json'));
  const pageSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['page_number', 'panels', 'page_summary'],
    properties: {
      page_number: { type: 'integer', minimum: 1 },
      page_summary: { type: 'string' },
      panels: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['panel_number', 'shot', 'beat', 'focus', 'dialogue_intent', 'tone', 'evidence'],
          properties: {
            panel_number: { type: 'integer', minimum: 1 },
            shot: { type: 'string' },
            beat: { type: 'string' },
            focus: { type: 'string' },
            dialogue_intent: { type: 'string' },
            tone: { type: 'string', enum: ['SETUP', 'TENSION', 'HORROR', 'SATIRE', 'ACTION', 'REVEAL', 'AFTERMATH', 'OTHER'] },
            evidence: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['block_type', 'block_index', 'text_snippet'],
                properties: {
                  block_type: { type: 'string', enum: ['ART_NOTE', 'NARRATOR', 'DIALOGUE', 'CAPTION', 'SFX', 'CRAWLER', 'TITLE_CARD', 'OTHER'] },
                  block_index: { type: 'integer', minimum: 0 },
                  text_snippet: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  };
  const finalSchema = parseJson(resolve(cwd, 'schemas/storyboard.v2.schema.json'));

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateNormalized = ajv.compile(normalizedSchema);
  if (!validateNormalized(normalized)) {
    const errs = (validateNormalized.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`Input normalized JSON invalid:\n${errs}`);
  }
  const validatePage = ajv.compile(pageSchema);
  const validateFinal = ajv.compile(finalSchema);

  const output = { pages: [], warnings: [] };

  for (const page of normalized.pages) {
    const requestPayload = { page_number: page.page_number, panels: page.panels };
    const prompt = `${SYSTEM_PROMPT}\n\nINPUT_PAGE_JSON:\n${JSON.stringify(requestPayload)}`;
    try {
      const responseText = await callProvider(prompt);
      const parsed = JSON.parse(stripMarkdownFences(responseText));
      if (!validatePage(parsed)) {
        const errs = (validatePage.errors ?? []).map((e) => `${e.instancePath || '/'}: ${e.message}`).join('; ');
        output.warnings.push(`Page ${page.page_number} skipped: model output schema invalid (${errs})`);
        continue;
      }
      validatePageGrounding(parsed, page);
      output.pages.push(parsed);
    } catch (error) {
      output.warnings.push(`Page ${page.page_number} skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  output.pages.sort((a, b) => a.page_number - b.page_number);

  if (!validateFinal(output)) {
    const errs = (validateFinal.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`).join('\n');
    throw new Error(`Final storyboard.v2 output invalid:\n${errs}`);
  }

  const tempPath = `${outputPath}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  renameSync(tempPath, outputPath);
  console.log(`Wrote: ${outputPath}`);
  if (output.warnings.length) {
    console.log(`Warnings: ${output.warnings.length}`);
    for (const w of output.warnings) console.log(`- ${w}`);
  }
} catch (error) {
  rmSync(`${outputPath}.tmp`, { force: true });
  console.error(`storyboard-ai failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
