import Link from 'next/link';
import { notFound } from 'next/navigation';
import PrintButton from '@/components/PrintButton';
import { formatNumber, readCountryIndex, readCountryProfile } from '@/lib/data';

export function generateStaticParams() {
  return readCountryIndex().map((country) => ({ code: country.code }));
}

export default function CountryPage({ params }: { params: { code: string } }) {
  const profile = readCountryProfile(params.code);

  if (!profile) {
    notFound();
  }

  const country = profile;

  const stats = [
    { label: 'Population', value: formatNumber(country.population) },
    { label: 'GDP (USD)', value: formatNumber(country.gdpUsd) },
    { label: 'GDP per capita (USD)', value: formatNumber(country.gdpPerCapitaUsd) }
  ];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm text-slate-700 underline underline-offset-2 hover:text-slate-900">
          ← Back to country list
        </Link>
        <PrintButton />
      </div>

      <article className="print-card rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-3xl font-bold">{country.name}</h1>
          <p className="mt-1 text-slate-600">Country code: {country.code}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Fact label="Capital" value={country.capital} />
          <Fact label="Region" value={country.region} />
          <Fact label="Currencies" value={country.currencies.join(', ') || 'N/A'} />
          <Fact label="Languages" value={country.languages.join(', ') || 'N/A'} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((item) => (
            <Fact key={item.label} label={item.label} value={item.value} />
          ))}
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-600">
          <p className="font-semibold">Sources</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {country.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} className="underline" target="_blank" rel="noreferrer">
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2">Last updated: {new Date(country.updatedAt).toLocaleDateString('en-US')}</p>
        </footer>
      </article>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-medium text-slate-900">{value}</p>
    </div>
  );
}
