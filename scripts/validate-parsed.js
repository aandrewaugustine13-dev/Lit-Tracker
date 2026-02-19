#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const outputDirArg = process.argv[2] ?? 'out/parsed';
const cwd = process.cwd();
const outputDir = resolve(cwd, outputDirArg);

const checks = [
  {
    label: 'storyboard',
    dataPath: resolve(outputDir, 'storyboard.json'),
    schemaPath: resolve(cwd, 'schemas/storyboard.v1.schema.json')
  },
  {
    label: 'character-tracker',
    dataPath: resolve(outputDir, 'character-tracker.json'),
    schemaPath: resolve(cwd, 'schemas/character-tracker.v1.schema.json')
  },
  {
    label: 'lore-tracker',
    dataPath: resolve(outputDir, 'lore-tracker.json'),
    schemaPath: resolve(cwd, 'schemas/lore-tracker.v1.schema.json')
  }
];

const ajv = new Ajv2020({ allErrors: true, strict: false });
let hasError = false;

for (const check of checks) {
  try {
    const schema = JSON.parse(readFileSync(check.schemaPath, 'utf8'));
    const data = JSON.parse(readFileSync(check.dataPath, 'utf8'));
    const validate = ajv.compile(schema);
    const valid = validate(data);
    if (!valid) {
      hasError = true;
      console.error(`Invalid ${check.label}:`);
      for (const err of validate.errors ?? []) {
        console.error(`- ${err.instancePath || '/'}: ${err.message}`);
      }
    } else {
      console.log(`Valid ${check.label}: ${check.dataPath}`);
    }
  } catch (error) {
    hasError = true;
    console.error(`Failed ${check.label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

process.exit(hasError ? 1 : 0);
