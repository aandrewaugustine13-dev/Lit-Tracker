import HomePageClient from '../components/HomePageClient';
import Seal from '../components/Seal';
import countries from '../data/all-countries.json';

export default function HomePage() {
  return (
    <main className="container">
      <header className="home-header">
        <Seal />
        <div>
          <h1>THE COUNTRY FACTBOOK</h1>
          <p>Reference Edition 2026</p>
        </div>
      </header>

      <HomePageClient countries={countries} />
    </main>
  );
}
