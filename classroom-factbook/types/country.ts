export type CountryIndexEntry = {
  code: string;
  name: string;
};

export type CountryProfile = {
  code: string;
  name: string;
  capital: string;
  region: string;
  population: number | null;
  gdpUsd: number | null;
  gdpPerCapitaUsd: number | null;
  currencies: string[];
  languages: string[];
  sources: { name: string; url: string }[];
  updatedAt: string;
};
