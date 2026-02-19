#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const inputArg = process.argv[2] ?? 'out/normalized.json';
const outputDirArg = process.argv[3] ?? 'out/parsed';
const cwd = process.cwd();

const inputPath = resolve(cwd, inputArg);
const outputDir = resolve(cwd, outputDirArg);
const storyboardPath = resolve(outputDir, 'storyboard.json');
const characterPath = resolve(outputDir, 'character-tracker.json');
const lorePath = resolve(outputDir, 'lore-tracker.json');

const artifactCueRegex = /\b(wristband|pass|tire iron|odyssey|orb|luggage cart|sunglasses|cruise ship)\b/gi;
const corporateTermRegex = /\b(ROI|SYNERGY|RESTRUCTURED|KPI|MARGIN|LEVERAGE|PIVOT)\b/g;
const corporateJargonSfxRegex = /\b(SYNERGY|ROI|RESTRUCTURED)\b/;
const explicitLocationCaptionRegex = /^[A-Z0-9][^\n]*[,.-][^\n]*(MORNING|AFTERNOON|EVENING|NIGHT|DAY|DAWN|DUSK|AM|PM)?\.?$/i;
const narratorStateChangeRegex = /\b(died|began to rise|jaws closing)\b/i;
const factionRoleRegex = /\b(MONK|CRUISE EMPLOYEE)\b/g;

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => String(a).localeCompare(String(b)));
}

function parseJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function validateNormalized(normalized) {
  const schema = parseJson(resolve(cwd, 'schemas/normalized-script.v1.schema.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(normalized)) {
    const lines = (validate.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`);
    throw new Error(`Input normalized JSON is invalid:\n${lines.join('\n')}`);
  }
}

function pushNamedPage(map, name, pageNumber) {
  if (!name) return;
  const key = name.trim();
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(pageNumber);
}

function detectArtNoteNames(text) {
  const names = [];
  const regex = /\b([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)\s*(?:\((?:\d+|[A-Z]+)\))?/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (candidate.length >= 2) names.push(candidate);
  }
  return uniqueSorted(names);
}

try {
  const normalized = parseJson(inputPath);
  validateNormalized(normalized);

  mkdirSync(outputDir, { recursive: true });

  const characterStats = new Map();
  const artifactMap = new Map();
  const locationMap = new Map();
  const conceptMap = new Map();
  const eventMap = new Map();
  const canonMap = new Map();
  const factionMap = new Map();

  const storyboardPages = normalized.pages.map((page) => {
    const pageChars = new Set();
    const pageLocations = new Set();
    const pageTimeMarkers = new Set();
    const pageBeats = new Set();

    for (const panel of page.panels) {
      for (const block of panel.blocks) {
        const text = String(block.text || '');

        if (block.type === 'NARRATOR') {
          pageBeats.add('Narrator observation present');
          const canonText = text.trim();
          if (/^The\b/.test(canonText) || /\bwas\b/i.test(canonText) || /\bbegan\b/i.test(canonText)) {
            pushNamedPage(canonMap, canonText, page.page_number);
          }
          const keyword = narratorStateChangeRegex.exec(canonText)?.[1];
          if (keyword) {
            pushNamedPage(eventMap, `Event candidate: ${keyword}`, page.page_number);
          }
          narratorStateChangeRegex.lastIndex = 0;
        }

        if (block.type === 'SFX') {
          if (corporateJargonSfxRegex.test(text)) pageBeats.add('Corporate-jargon SFX');
          corporateJargonSfxRegex.lastIndex = 0;
        }

        if (block.type === 'TITLE_CARD') pageBeats.add('Title card');
        if (block.type === 'CRAWLER') pageBeats.add('News crawler');

        if (block.type === 'DIALOGUE') {
          const speaker = String(block.speaker || '').trim();
          if (speaker) {
            pageChars.add(speaker);
            pageBeats.add(`Dialogue from ${speaker}`);
            if (!characterStats.has(speaker)) {
              characterStats.set(speaker, { pages: new Set(), lines: 0, quotes: [] });
            }
            const st = characterStats.get(speaker);
            st.pages.add(page.page_number);
            st.lines += 1;
            if (st.quotes.length < 2) st.quotes.push(text);
          }

          const terms = text.match(corporateTermRegex) || [];
          for (const term of terms) pushNamedPage(conceptMap, term, page.page_number);
          corporateTermRegex.lastIndex = 0;
        }

        if (block.type === 'ART_NOTE') {
          for (const n of detectArtNoteNames(text)) {
            pageChars.add(n);
            if (!characterStats.has(n)) {
              characterStats.set(n, { pages: new Set(), lines: 0, quotes: [] });
            }
            characterStats.get(n).pages.add(page.page_number);
          }

          const welcomeMatch = text.match(/WELCOME TO\s+([^\n.!]+)/i);
          if (welcomeMatch) {
            const loc = welcomeMatch[1].trim();
            pageLocations.add(loc);
            pushNamedPage(locationMap, loc, page.page_number);
          }

          const artifacts = text.match(artifactCueRegex) || [];
          for (const artifact of artifacts) pushNamedPage(artifactMap, artifact.toLowerCase(), page.page_number);
          artifactCueRegex.lastIndex = 0;

          const capsGroups = text.match(/\bTHE\s+[A-Z][A-Z\s]+\b/g) || [];
          for (const g of capsGroups) pushNamedPage(factionMap, g.trim(), page.page_number);

          const roleGroups = text.match(factionRoleRegex) || [];
          for (const g of roleGroups) pushNamedPage(factionMap, g.trim(), page.page_number);
          factionRoleRegex.lastIndex = 0;
        }

        if (block.type === 'CAPTION') {
          const caption = text.trim();
          if (explicitLocationCaptionRegex.test(caption)) {
            pageLocations.add(caption);
            pageTimeMarkers.add(caption);
            pushNamedPage(locationMap, caption, page.page_number);
            pushNamedPage(eventMap, `Event candidate: caption marker`, page.page_number);
          }
        }

        if (block.type === 'SFX') {
          const terms = text.match(corporateTermRegex) || [];
          for (const term of terms) pushNamedPage(conceptMap, term, page.page_number);
          corporateTermRegex.lastIndex = 0;
        }
      }
    }

    return {
      page_number: page.page_number,
      panel_count: page.panels.length,
      locations: uniqueSorted(Array.from(pageLocations)),
      time_markers: uniqueSorted(Array.from(pageTimeMarkers)),
      characters: uniqueSorted(Array.from(pageChars)),
      beats: uniqueSorted(Array.from(pageBeats))
    };
  });

  const characterTracker = {
    characters: Array.from(characterStats.entries())
      .map(([name, st]) => {
        const pages = Array.from(st.pages).sort((a, b) => a - b);
        return {
          name,
          pages_present: pages,
          first_appearance_page: pages[0],
          lines_count: st.lines,
          notable_quotes: st.quotes
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  };

  function mapToArray(map) {
    return Array.from(map.entries())
      .map(([name, pages]) => ({ name, pages: Array.from(pages).sort((a, b) => a - b) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const loreTracker = {
    artifacts: mapToArray(artifactMap),
    locations: mapToArray(locationMap),
    concepts: mapToArray(conceptMap),
    events: mapToArray(eventMap),
    canon: mapToArray(canonMap),
    factions: mapToArray(factionMap)
  };

  const storyboard = { pages: storyboardPages };

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaChecks = [
    ['storyboard', storyboard, parseJson(resolve(cwd, 'schemas/storyboard.v1.schema.json'))],
    ['character-tracker', characterTracker, parseJson(resolve(cwd, 'schemas/character-tracker.v1.schema.json'))],
    ['lore-tracker', loreTracker, parseJson(resolve(cwd, 'schemas/lore-tracker.v1.schema.json'))]
  ];

  for (const [name, data, schema] of schemaChecks) {
    const validate = ajv.compile(schema);
    if (!validate(data)) {
      const lines = (validate.errors ?? []).map((e) => `- ${e.instancePath || '/'}: ${e.message}`);
      throw new Error(`${name} output failed schema validation:\n${lines.join('\n')}`);
    }
  }

  const tempStoryboard = `${storyboardPath}.tmp`;
  const tempCharacter = `${characterPath}.tmp`;
  const tempLore = `${lorePath}.tmp`;

  writeFileSync(tempStoryboard, `${JSON.stringify(storyboard, null, 2)}\n`, 'utf8');
  writeFileSync(tempCharacter, `${JSON.stringify(characterTracker, null, 2)}\n`, 'utf8');
  writeFileSync(tempLore, `${JSON.stringify(loreTracker, null, 2)}\n`, 'utf8');

  renameSync(tempStoryboard, storyboardPath);
  renameSync(tempCharacter, characterPath);
  renameSync(tempLore, lorePath);

  console.log(`Wrote: ${storyboardPath}`);
  console.log(`Wrote: ${characterPath}`);
  console.log(`Wrote: ${lorePath}`);
} catch (error) {
  const outputDir = resolve(cwd, outputDirArg);
  rmSync(resolve(outputDir, 'storyboard.json.tmp'), { force: true });
  rmSync(resolve(outputDir, 'character-tracker.json.tmp'), { force: true });
  rmSync(resolve(outputDir, 'lore-tracker.json.tmp'), { force: true });
  console.error(`parse-normalized failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
