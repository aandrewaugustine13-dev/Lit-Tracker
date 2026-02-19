# Classroom Factbook

Classroom Factbook is a static Next.js site that provides printable, one-page country fact sheets for students.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS for clean, print-friendly styling
- Static export (`next build` with `output: "export"`)

## Project structure

- `app/` - pages and layouts
- `components/` - reusable UI components
- `data/index.json` - country code/name index
- `data/countries/{CODE}.json` - full country profiles
- `scripts/build-data.ts` - data pipeline script for generating JSON data

## Local setup

```bash
npm install
npm run build:data
npm run dev
```

Visit `http://localhost:3000`.

## Build static site

```bash
npm run build
```

Static files are output to `out/`.

## Data pipeline

`npm run build:data` does the following:

1. Fetches World Bank indicators:
   - Population (`SP.POP.TOTL`)
   - GDP (`NY.GDP.MKTP.CD`)
   - GDP per capita (`NY.GDP.PCAP.CD`)
2. Fetches REST Countries fields:
   - name, capital, region, currencies, languages
3. Merges the data into the `CountryProfile` schema and writes:
   - `data/index.json`
   - `data/countries/{CODE}.json`

## Deploy to Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Use these settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Output directory**: `out`
4. Deploy.

Because this app is statically exported, it requires no server runtime.
