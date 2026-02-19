import CountrySearchList from '@/components/CountrySearchList';
import { readCountryIndex } from '@/lib/data';

export default function HomePage() {
  const countries = readCountryIndex();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Classroom Factbook</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Browse country profiles and print one-page fact sheets for class activities.
        </p>
      </header>
      <CountrySearchList countries={countries} />
    </main>
  );
}
