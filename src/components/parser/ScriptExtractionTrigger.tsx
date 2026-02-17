import React, { useState } from 'react';
import { X, Upload, Zap, Cpu, HardDrive } from 'lucide-react';
import { useLitStore } from '../../store';
import { parseScriptAndProposeUpdates, LLMProvider } from '../../engine/universalScriptParser';
import { parseScriptWithLLM, ParsedScript, LoreCandidate } from '../../utils/scriptParser';
import { smartFallbackParse } from '../../utils/smartFallbackParser';
import { buildCanonicalScriptExtraction } from '../../utils/canonicalScriptExtraction';
import { isGoogleDriveConfigured } from '../../services/googleDrive';
import { DriveFilePicker } from '../shared/DriveFilePicker';

// =============================================================================
// SCRIPT EXTRACTION TRIGGER — Modal for inputting script text and triggering parser
// =============================================================================

interface ScriptExtractionTriggerProps {
  onClose: () => void;
}

type ParseMode = 'llm' | 'deterministic';
type ProviderOption = 'anthropic' | 'gemini' | 'openai' | 'grok' | 'deepseek' | 'groq';

// Duration to display warning message before auto-closing modal (in milliseconds)
const WARNING_DISPLAY_DURATION_MS = 3000;

const PROVIDER_META: Record<ProviderOption, { label: string; placeholder: string; helpUrl: string; browserWorks: boolean }> = {
  anthropic: { label: 'Claude', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys', browserWorks: true },
  gemini:    { label: 'Gemini', placeholder: 'AIza...', helpUrl: 'https://aistudio.google.com/apikey', browserWorks: true },
  groq:      { label: 'Groq', placeholder: 'gsk_...', helpUrl: 'https://console.groq.com/keys', browserWorks: false },
  openai:    { label: 'OpenAI', placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys', browserWorks: false },
  grok:      { label: 'Grok', placeholder: 'xai-...', helpUrl: 'https://console.x.ai', browserWorks: false },
  deepseek:  { label: 'DeepSeek', placeholder: 'sk-...', helpUrl: 'https://platform.deepseek.com/api_keys', browserWorks: false },
};

const PROVIDERS: ProviderOption[] = ['anthropic', 'gemini', 'groq', 'openai', 'grok', 'deepseek'];

export const ScriptExtractionTrigger: React.FC<ScriptExtractionTriggerProps> = ({ onClose }) => {
  const [scriptText, setScriptText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [parseMode, setParseMode] = useState<ParseMode>('llm');
  const [provider, setProvider] = useState<ProviderOption>('anthropic');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const projectConfig = useLitStore((s) => s.projectConfig);
  const characters = useLitStore((s) => s.characters);
  const normalizedLocations = useLitStore((s) => s.normalizedLocations);
  const normalizedItems = useLitStore((s) => s.normalizedItems);
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);
  const setParserStatus = useLitStore((s) => s.setParserStatus);
  const setParserError = useLitStore((s) => s.setParserError);
  const setParsedScriptResult = useLitStore((s) => s.setParsedScriptResult);

  const enableLLM = parseMode === 'llm';
  const meta = PROVIDER_META[provider];

  const handleParse = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('Please enter script text to parse');
      return;
    }

    setIsLoading(true);
    setParserStatus('parsing');
    setErrorMessage(null);

    try {
      let formattedScript: string | undefined = undefined;
      let loreCandidates: LoreCandidate[] | undefined = undefined;
      let parsedScript: ParsedScript | undefined = undefined;
      let llmFormatFailed = false;

      // ═══ STEP 1: AI FORMATTING (if LLM mode is enabled) ═══
      if (enableLLM && apiKey) {
        // All providers now work - browser-compatible ones go direct, others via proxy
        try {
          console.log('[ScriptExtraction] Starting AI formatting and normalization...');
          parsedScript = await parseScriptWithLLM(
            scriptText,
            provider,
            apiKey
          );
          
          // Build canonical artifacts from the single AI read
          const canonicalExtraction = buildCanonicalScriptExtraction(parsedScript);
          formattedScript = canonicalExtraction.formattedScriptText;
          loreCandidates = canonicalExtraction.loreCandidates;
          
          console.log('[ScriptExtraction] AI formatting complete:', {
            pages: parsedScript.pages.length,
            characters: parsedScript.characters.length,
            loreCandidates: loreCandidates.length
          });
        } catch (formatError) {
          llmFormatFailed = true;
          const errorMsg = formatError instanceof Error ? formatError.message : 'Unknown error';
          console.warn('[ScriptExtraction] AI formatting failed:', formatError);
          
          // Surface the error to the user as a warning
          setErrorMessage(
            `⚠️ AI formatting failed: ${errorMsg}. Lore extraction will continue with pattern matching only. Storyboard import may be limited.`
          );
          
          // Continue without formatted script - the parser will work with raw text
        }
      } else {
        console.log('[ScriptExtraction] Skipping AI formatting (LLM disabled or no API key)');
      }

      // ═══ STEP 2: LORE EXTRACTION ═══
      // Pass formatted script (if available) and lore candidates to the parser
      console.log('[ScriptExtraction] Starting lore extraction...');
      const proposal = await parseScriptAndProposeUpdates({
        rawScriptText: scriptText,
        formattedScriptText: formattedScript,
        externalLoreCandidates: loreCandidates,
        config: projectConfig,
        characters,
        normalizedLocations,
        normalizedItems,
        llmApiKey: enableLLM ? apiKey : undefined,
        llmProvider: enableLLM ? provider : undefined,
        enableLLM,
      });

      // ═══ STEP 3: STORE PARSED SCRIPT FOR INK TRACKER ═══
      // Keep Ink fed with a panelized script whenever possible.
      try {
        const llmHasPanels = !!parsedScript?.pages?.some(
          page => Array.isArray(page.panels) && page.panels.length > 0
        );

        if (llmHasPanels && parsedScript) {
          setParsedScriptResult(parsedScript, scriptText);
          console.log('[ScriptExtraction] Stored LLM-parsed script for Ink Tracker import');
        } else {
          const fallbackScript = smartFallbackParse(scriptText);
          setParsedScriptResult(fallbackScript, scriptText);
          if (parsedScript && !llmHasPanels) {
            console.warn('[ScriptExtraction] LLM parse had no panels; stored fallback storyboard parse for Ink import');
          } else {
            console.log('[ScriptExtraction] Stored fallback parsed script for Ink Tracker import');
          }
        }
      } catch (storeError) {
        console.warn('[ScriptExtraction] Failed to store parsed script for Ink Tracker:', storeError);
        // Non-fatal - continue
      }

      setCurrentProposal(proposal);
      console.log('[ScriptExtraction] Extraction complete:', {
        newEntities: proposal.newEntities.length,
        updatedEntities: proposal.updatedEntities.length,
        timelineEvents: proposal.newTimelineEvents.length,
      });

      // Don't close the modal immediately if there was an LLM error (so user can see the warning)
      if (!llmFormatFailed) {
        onClose();
      } else {
        // Give user time to see the warning, then auto-close
        // Note: We always close after the timeout regardless of loading state since extraction has completed
        setTimeout(() => {
          onClose();
        }, WARNING_DISPLAY_DURATION_MS);
      }
    } catch (error) {
      console.error('Parsing error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      setParserError(errorMsg);
      setErrorMessage(`Parsing failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setScriptText(ev.target?.result as string || '');
      };
      reader.readAsText(file);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card border-stone-200 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-ember-500" />
            <h2 className="font-display text-2xl text-ink">Extract Lore from Script</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-stone-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setParseMode('llm')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-body font-semibold text-sm transition-colors ${
                  parseMode === 'llm'
                    ? 'bg-ink text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Zap className="w-4 h-4" />
                AI Extraction
              </button>
              <button
                onClick={() => setParseMode('deterministic')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-body font-semibold text-sm transition-colors ${
                  parseMode === 'deterministic'
                    ? 'bg-ink text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Pattern Only
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-700">
              <p className="font-body mb-2">
                <strong>How it works:</strong> Paste your script text below, and the parser will extract:
              </p>
              <ul className="list-disc list-inside space-y-1 text-stone-600 ml-2">
                <li>Characters (from dialogue speakers and mentions)</li>
                <li>Locations (from slug-lines and scene headings)</li>
                {parseMode === 'llm' && (
                  <>
                    <li>Factions and Organizations</li>
                    <li>Events and significant moments</li>
                    <li>Concepts, powers, and phenomena</li>
                    <li>Artifacts and significant objects</li>
                    <li>World rules and mechanics</li>
                  </>
                )}
                <li>Items (from action descriptions)</li>
                <li>Timeline events (character movements, item transfers)</li>
              </ul>
              <p className="mt-3 text-stone-600">
                {parseMode === 'llm'
                  ? 'AI extraction first formats your script, then extracts entities with advanced pattern recognition and LLM-powered analysis.'
                  : 'Pattern-only mode uses deterministic rules — no API key needed.'}
              </p>
              {parseMode === 'deterministic' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-semibold text-xs mb-1">⚠️ Limited Extraction</p>
                  <p className="text-amber-700 text-xs">
                    Pattern-only mode can only reliably extract characters and locations. 
                    For factions, events, concepts, artifacts, and rules, please use AI Extraction mode.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-3 h-3 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-body font-semibold text-red-800 mb-1">
                    Parsing Error
                  </p>
                  <p className="text-sm text-red-700">
                    {errorMessage}
                  </p>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="flex-shrink-0 p-1 hover:bg-red-100 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            )}

            {/* Script Text Input */}
            <div>
              <label className="block text-sm font-body font-semibold text-ink mb-2">
                Script Text
              </label>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Paste your script text here...

Example:
INT. APARTMENT - NIGHT

Panel 1 Interior apartment. ELI sits at a table.

ELI
  I've been searching for years.

Panel 2 Close-up of the ANCIENT SWORD on the table."
                className="w-full h-64 px-4 py-3 border border-stone-200 rounded font-mono text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 resize-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <label className="cursor-pointer px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg text-sm font-body font-medium text-stone-700 transition-colors flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload File
                  <input
                    type="file"
                    accept=".txt,.fountain,.fdx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {isGoogleDriveConfigured() && (
                  <button
                    onClick={() => setShowDrivePicker(true)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-lg text-sm font-body font-medium text-stone-700 transition-colors flex items-center gap-2"
                  >
                    <HardDrive className="w-4 h-4" />
                    Google Drive
                  </button>
                )}
                <span className="text-xs text-stone-500">
                  {scriptText ? `${scriptText.length} characters` : 'No text entered'}
                </span>
              </div>
            </div>

            {/* LLM Provider & API Key (only in LLM mode) */}
            {parseMode === 'llm' && (
              <div className="border border-stone-200 rounded-lg p-4 space-y-3">
                <p className="font-body font-semibold text-ink text-sm">AI Provider</p>
                <div className="flex flex-wrap gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors ${
                        provider === p
                          ? 'bg-ink text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {PROVIDER_META[p].label}
                    </button>
                  ))}
                </div>

                {!meta.browserWorks && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-amber-600 flex-shrink-0 mt-0.5 text-sm">⚠️</span>
                    <p className="text-xs text-amber-800">
                      {meta.label} routes through a server proxy to avoid CORS restrictions.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-body font-medium text-ink mb-1">
                    {meta.label} API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={meta.placeholder}
                    className="w-full px-3 py-2 border border-stone-200 rounded text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Get your API key at{' '}
                    <a
                      href={meta.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ember-500 hover:underline"
                    >
                      {meta.helpUrl.replace('https://', '')}
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
          <button
            onClick={onClose}
            className="px-4 py-2 font-body text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={isLoading || !scriptText.trim()}
            className="px-6 py-2 font-body font-semibold text-white bg-ink hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                {parseMode === 'llm' ? <Zap className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                Parse Script
              </>
            )}
          </button>
        </div>
      </div>
    </div>

    {/* Google Drive File Picker */}
    {showDrivePicker && (
      <DriveFilePicker
        onSelect={(content, filename) => {
          setScriptText(content);
          setShowDrivePicker(false);
        }}
        onClose={() => setShowDrivePicker(false)}
      />
    )}
    </>
  );
};
