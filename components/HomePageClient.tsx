'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type CountryCard = {
  code: string;
  name_common: string;
  flag_url: string;
  region: string;
};

export default function HomePageClient({ countries }: { countries: CountryCard[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) => {
      return (
        c.name_common.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q)
      );
    });
  }, [countries, query]);

  return (
    <>
      <label htmlFor="search" className="sr-only">
        Search countries
      </label>
      <input
        id="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by country, ISO3 code, or region"
        className="search"
      />

      <p className="results-count">{filtered.length} countries</p>

      <ul className="country-grid" aria-label="Country list">
        {filtered.map((country) => (
          <li key={country.code}>
            <Link href={`/${country.code}`} className="country-card">
              <img src={country.flag_url} alt={`Flag of ${country.name_common}`} loading="lazy" />
              <div>
                <h2>{country.name_common}</h2>
                <p>
                  {country.region} · {country.code}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
