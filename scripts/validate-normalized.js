#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

const schemaPath = resolve(process.cwd(), 'schemas/normalized-script.v1.schema.json');
const inputArg = process.argv[2] ?? 'examples/normalized-script.v1.example.json';
const inputPath = resolve(process.cwd(), inputArg);

const loadJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const schema = loadJson(schemaPath);
const data = loadJson(inputPath);

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {
  console.log(`Valid: ${inputArg}`);
  process.exit(0);
}

console.error(`Invalid: ${inputArg}`);
for (const error of validate.errors ?? []) {
  const path = error.instancePath || '/';
  console.error(`- ${path}: ${error.message}`);
}
process.exit(1);
