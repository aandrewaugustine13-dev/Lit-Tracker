'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CountryIndexEntry } from '@/types/country';

type Props = {
  countries: CountryIndexEntry[];
};

export default function CountrySearchList({ countries }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((country) =>
      `${country.name} ${country.code}`.toLowerCase().includes(q)
    );
  }, [countries, query]);

  return (
    <section className="space-y-4">
      <div>
        <label htmlFor="search" className="mb-1 block text-sm font-medium text-slate-700">
          Search countries
        </label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: Kenya, BRA, Japan"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((country) => (
          <li key={country.code}>
            <Link
              href={`/country/${country.code}`}
              className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
            >
              <span className="font-semibold">{country.name}</span>
              <span className="ml-2 text-slate-500">({country.code})</span>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? <p className="text-sm text-slate-600">No countries found.</p> : null}
    </section>
  );
}
