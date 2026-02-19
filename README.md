# Lit-Tracker

A comprehensive script tracking and management application for screenwriters and production teams.

## Features

- **Script Parsing**: Import and parse screenplays in multiple formats (.txt, .fountain, .fdx)
- **Character Tracking**: Automatically extract and track characters throughout your script
- **Location Management**: Track scene locations and their usage
- **Item/Prop Tracking**: Keep tabs on important items and props in your story
- **Google Drive Integration**: Import script files directly from Google Drive
- **AI-Powered Parsing**: Support for multiple LLM providers (Claude, Gemini, OpenAI, Groq, Grok, DeepSeek)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/aandrewaugustine13-dev/Lit-Tracker.git
   cd Lit-Tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see [Google Drive Setup](#google-drive-setup) below):
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   If your machine cannot access the app from `localhost` with the default Vite bind address, start it with host exposure:
   ```bash
   npm run dev -- --host
   ```

5. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Google Drive Setup

The app supports importing script files directly from Google Drive. To enable this feature:

### Step 1: Create a Google Cloud Project and OAuth Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable the Google Drive API:
   - Navigate to **APIs & Services** > **Library**
   - Search for "Google Drive API"
   - Click **Enable**

4. Create OAuth 2.0 Client ID:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth 2.0 Client ID**
   - Select **Web application** as the application type
   - Add your application URLs to **Authorized JavaScript origins**:
     - For local development: `http://localhost:5173`
     - For production: Add your deployed app's URL (e.g., `https://your-app.vercel.app`)
   - Click **Create**
   - Copy the generated Client ID

### Step 2: Configure Your Application

#### For Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder with your actual Client ID:
   ```
   VITE_GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
   ```

3. Restart your development server if it's already running

#### For Vercel Deployments

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** > **Environment Variables**
3. Add a new environment variable:
   - **Name**: `VITE_GOOGLE_CLIENT_ID`
   - **Value**: Your Google OAuth Client ID
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**
5. Redeploy your application for the changes to take effect

### Using Google Drive Integration

Once configured, a "Google Drive" button will appear in the script import dialog. Click it to:
- Browse your Google Drive files
- Search for specific scripts
- Import files directly without downloading them first

**Note**: Users will be prompted to authorize the application the first time they use this feature. The app requests read-only access to Google Drive files.

## Development

### Project Structure

```
src/
├── components/       # React components
│   ├── parser/      # Script parsing components
│   └── shared/      # Reusable UI components
├── services/        # External service integrations (e.g., Google Drive)
├── hooks/           # Custom React hooks
├── engine/          # Core parsing and processing logic
├── utils/           # Utility functions
└── store/           # State management (Zustand)
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally


### Script Extraction Schema (Codex prep)

- `littracker.schema.json` defines a strict JSON Schema for `storyboard`, `character_tracker`, and `lore_tracker` output buckets.
- `examples/sample_script.txt` and `examples/sample_output.json` provide a deterministic 2-page reference pair for parser iteration.
- `scripts/parse-script.stub` is a minimal extraction stub that reads the sample script, splits by `PAGE N` headers, and emits schema-shaped JSON for downstream Codex extraction wiring.

Run the stub with:

```bash
node scripts/parse-script.stub
```

Next step: replace stub panel field population with the real extractor while keeping the schema keys stable for validation and ingestion.


## Normalization CLI (BYOK)

Generate NormalizedScript v1 JSON from a raw script:

```bash
npm run normalize
```

Then validate the generated file:

```bash
node scripts/validate-normalized.js out/normalized.json
```

## Validation: NormalizedScript v1

Run the schema validator against the included example:

```bash
npm run validate:normalized
```


## Step 4: Deterministic parsing

Run these commands in order:

```bash
npm run normalize
npm run validate:normalized
npm run parse:normalized
npm run validate:parsed
```


## Step 5: Storyboard v2 overlay (single LLM call batch)

Run these commands in order:

```bash
npm run normalize
npm run validate:normalized
npm run parse:normalized
npm run storyboard:ai
npm run validate:storyboard:v2
```

`storyboard:ai` now performs a single batch LLM call using a manifest of all page/panel pairs and writes `out/parsed/storyboard.v2.json` atomically. The batch output includes `coverage[]` and page/panel outputs; generation fails if manifest coverage is incomplete or if counts collapse unexpectedly.

## License

See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
