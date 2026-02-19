import fs from 'node:fs/promises';
import path from 'node:path';
import { CountryProfile } from '../types/country';

type RestCountry = {
  cca3: string;
  name: { common: string };
  capital?: string[];
  region?: string;
  currencies?: Record<string, { name: string }>;
  languages?: Record<string, string>;
};

type WorldBankEntry = {
  countryiso3code: string;
  value: number | null;
  date: string;
};

const INDICATORS = {
  population: 'SP.POP.TOTL',
  gdpUsd: 'NY.GDP.MKTP.CD',
  gdpPerCapitaUsd: 'NY.GDP.PCAP.CD'
} as const;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchRestCountries(): Promise<RestCountry[]> {
  return fetchJson<RestCountry[]>(
    'https://restcountries.com/v3.1/all?fields=cca3,name,capital,region,currencies,languages'
  );
}

async function fetchWorldBank(indicator: string): Promise<Map<string, number | null>> {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000`;
  const payload = await fetchJson<[unknown, WorldBankEntry[]]>(url);
  const entries = payload[1] || [];
  const values = new Map<string, number | null>();

  for (const entry of entries) {
    if (!entry.countryiso3code || entry.countryiso3code.length !== 3) continue;
    const code = entry.countryiso3code.toUpperCase();
    if (values.has(code)) continue;
    values.set(code, entry.value);
  }

  return values;
}

function toProfile(
  country: RestCountry,
  metrics: Record<keyof typeof INDICATORS, Map<string, number | null>>,
  updatedAt: string
): CountryProfile {
  const code = country.cca3.toUpperCase();
  return {
    code,
    name: country.name?.common || code,
    capital: country.capital?.[0] || 'N/A',
    region: country.region || 'N/A',
    population: metrics.population.get(code) ?? null,
    gdpUsd: metrics.gdpUsd.get(code) ?? null,
    gdpPerCapitaUsd: metrics.gdpPerCapitaUsd.get(code) ?? null,
    currencies: Object.values(country.currencies || {}).map((item) => item.name),
    languages: Object.values(country.languages || {}),
    sources: [
      { name: 'World Bank Open Data', url: 'https://data.worldbank.org/' },
      { name: 'REST Countries', url: 'https://restcountries.com/' }
    ],
    updatedAt
  };
}

async function main() {
  const dataRoot = path.join(process.cwd(), 'data');
  const countriesDir = path.join(dataRoot, 'countries');
  await fs.mkdir(countriesDir, { recursive: true });

  const [restCountries, population, gdpUsd, gdpPerCapitaUsd] = await Promise.all([
    fetchRestCountries(),
    fetchWorldBank(INDICATORS.population),
    fetchWorldBank(INDICATORS.gdpUsd),
    fetchWorldBank(INDICATORS.gdpPerCapitaUsd)
  ]);

  const updatedAt = new Date().toISOString();
  const metrics = { population, gdpUsd, gdpPerCapitaUsd };

  const profiles = restCountries
    .filter((country) => country.cca3 && country.name?.common)
    .map((country) => toProfile(country, metrics, updatedAt))
    .sort((a, b) => a.name.localeCompare(b.name));

  const index = profiles.map(({ code, name }) => ({ code, name }));

  await fs.writeFile(path.join(dataRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

  await Promise.all(
    profiles.map((profile) =>
      fs.writeFile(
        path.join(countriesDir, `${profile.code}.json`),
        `${JSON.stringify(profile, null, 2)}\n`
      )
    )
  );

  console.log(`Wrote ${profiles.length} country profiles.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
