import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import SectionHeader from '../../components/SectionHeader';
import StatRow from '../../components/StatRow';
import indexData from '../../data/index.json';

type Params = { code: string };

type IndexEntry = { code: string };

function readCountry(code: string): Record<string, any> {
  const filePath = path.join(process.cwd(), 'data', 'countries', `${code}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function v(obj: any, paths: string[], fallback = '—') {
  for (const p of paths) {
    const value = p.split('.').reduce((acc: any, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

export function generateStaticParams(): Params[] {
  return (indexData as IndexEntry[]).map((x) => ({ code: x.code }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const country = readCountry(params.code);
  const name = v(country, ['name.common', 'name_common']);
  return { title: `${name} — THE COUNTRY FACTBOOK` };
}

export default function CountryPage({ params }: { params: Params }) {
  const country = readCountry(params.code);
  const name = v(country, ['name.common', 'name_common']);

  return (
    <main className="container country-page">
      <nav className="print-hide">
        <Link href="/">← Back to country index</Link>
      </nav>

      <header className="country-header">
        <img src={v(country, ['flags.svg', 'flag_url'], '')} alt={`Flag of ${name}`} />
        <div>
          <h1>{name}</h1>
          <p>
            {v(country, ['region'])} · {params.code}
          </p>
        </div>
      </header>

      <div className="two-col">
        <section>
          <SectionHeader title="BASICS" />
          <dl>
            <StatRow label="Official name" value={v(country, ['name.official', 'name_official'])} />
            <StatRow label="Capital" value={v(country, ['capital.0', 'capital'])} />
            <StatRow label="Region" value={v(country, ['region'])} />
            <StatRow label="Subregion" value={v(country, ['subregion'])} />
            <StatRow label="Area (sq km)" value={v(country, ['area_km2', 'area'])} />
          </dl>
        </section>

        <section>
          <SectionHeader title="PEOPLE" />
          <dl>
            <StatRow label="Population" value={v(country, ['population'])} />
            <StatRow label="Demonym" value={v(country, ['demonym', 'demonyms.eng.m'])} />
            <StatRow label="Languages" value={v(country, ['languages_display', 'languages'])} />
            <StatRow label="Urban population (%)" value={v(country, ['urban_population_pct'])} />
          </dl>
        </section>

        <section>
          <SectionHeader title="ECONOMY" />
          <dl>
            <StatRow label="GDP (current US$)" value={v(country, ['gdp_usd', 'economy.gdp_current_usd'])} />
            <StatRow label="GDP per capita (US$)" value={v(country, ['gdp_per_capita_usd'])} />
            <StatRow label="Inflation (%)" value={v(country, ['inflation_pct'])} />
            <StatRow label="Currency" value={v(country, ['currency_name', 'currencies_display'])} />
          </dl>
        </section>

        <section>
          <SectionHeader title="GOVERNMENT" />
          <dl>
            <StatRow label="Government type" value={v(country, ['government_type'])} />
            <StatRow label="Head of state" value={v(country, ['head_of_state'])} />
            <StatRow label="Head of government" value={v(country, ['head_of_government'])} />
            <StatRow label="UN member" value={v(country, ['un_member']) ? 'Yes' : 'No'} />
          </dl>
        </section>

        <section className="full-width">
          <SectionHeader title="SOURCES" />
          <p>REST Countries API; World Bank Open Data; United Nations member list.</p>
        </section>
      </div>
    </main>
  );
}
