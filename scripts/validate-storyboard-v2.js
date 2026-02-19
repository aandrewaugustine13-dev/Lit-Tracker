#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const inputArg = process.argv[2] ?? 'out/parsed/storyboard.v2.json';
const inputPath = resolve(process.cwd(), inputArg);
const schemaPath = resolve(process.cwd(), 'schemas/storyboard.batch.v1.schema.json');

try {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const data = JSON.parse(readFileSync(inputPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    console.error(`Invalid storyboard batch: ${inputArg}`);
    for (const err of validate.errors ?? []) {
      console.error(`- ${err.instancePath || '/'}: ${err.message}`);
    }
    process.exit(1);
  }

  console.log(`Valid storyboard batch: ${inputArg}`);
} catch (error) {
  console.error(`validate-storyboard-v2 failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
