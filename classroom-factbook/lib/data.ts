import fs from 'node:fs';
import path from 'node:path';
import { CountryIndexEntry, CountryProfile } from '@/types/country';

const dataRoot = path.join(process.cwd(), 'data');

export function readCountryIndex(): CountryIndexEntry[] {
  const filePath = path.join(dataRoot, 'index.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CountryIndexEntry[];
}

export function readCountryProfile(code: string): CountryProfile | null {
  const filePath = path.join(dataRoot, 'countries', `${code.toUpperCase()}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as CountryProfile;
}

export function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}
