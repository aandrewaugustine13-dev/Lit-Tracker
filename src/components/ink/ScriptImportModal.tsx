import React, { useState, useRef } from 'react';
import { X, Upload, Zap, Cpu, AlertTriangle, Globe } from 'lucide-react';
import { parseScriptWithLLM, ParsedScript } from '../../utils/scriptParser';
import { smartFallbackParse } from '../../utils/smartFallbackParser';
import { ParseResult } from '../../services/scriptParser';
import { parsedScriptToParseResult } from '../../utils/canonicalScriptExtraction';
import { useLitStore } from '../../store';

// =============================================================================
// SCRIPT IMPORT MODAL — Direct paste-and-parse for Ink Tracker storyboard
// =============================================================================
// Bypasses Lore Tracker entirely. Paste script → get storyboard panels.
// Also stores parsedScriptResult so Lore Tracker can use it later if wanted.

type ParseMode = 'llm' | 'deterministic';
type ProviderOption = 'gemini' | 'anthropic' | 'openai' | 'grok' | 'deepseek';

interface ProviderMeta {
  label: string;
  placeholder: string;
  helpUrl: string;
  browserWorks: boolean; // Whether direct browser fetch works (no CORS block)
}

const PROVIDER_META: Record<ProviderOption, ProviderMeta> = {
  gemini:    { label: 'Gemini',   placeholder: 'AIza...',    helpUrl: 'https://aistudio.google.com/apikey',          browserWorks: true },
  anthropic: { label: 'Claude',   placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys', browserWorks: true },
  openai:    { label: 'OpenAI',   placeholder: 'sk-...',     helpUrl: 'https://platform.openai.com/api-keys',        browserWorks: false },
  grok:      { label: 'Grok',     placeholder: 'xai-...',    helpUrl: 'https://console.x.ai',                        browserWorks: false },
  deepseek:  { label: 'DeepSeek', placeholder: 'sk-...',     helpUrl: 'https://platform.deepseek.com/api_keys',      browserWorks: false },
};

// Show browser-compatible providers first
const PROVIDERS: ProviderOption[] = ['gemini', 'anthropic', 'openai', 'grok', 'deepseek'];

// ─── Component ─────────────────────────────────────────────────────────────

interface ScriptImportModalProps {
  onImport: (result: ParseResult, scriptText: string) => void;
  onClose: () => void;
}

export const ScriptImportModal: React.FC<ScriptImportModalProps> = ({ onImport, onClose }) => {
  const [scriptText, setScriptText] = useState('');
  const [parseMode, setParseMode] = useState<ParseMode>('deterministic');
  const [provider, setProvider] = useState<ProviderOption>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setParsedScriptResult = useLitStore((s) => s.setParsedScriptResult);
  const meta = PROVIDER_META[provider];

  const handleParse = async () => {
    if (!scriptText.trim()) {
      setError('Paste or upload a script first.');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      let parsed: ParsedScript;

      if (parseMode === 'llm' && apiKey.trim()) {
        if (!meta.browserWorks) {
          setError(
            `${meta.label} blocks direct browser requests (CORS). Use Gemini or Claude instead, or run the app through a proxy server.`
          );
          setIsLoading(false);
          return;
        }
        parsed = await parseScriptWithLLM(scriptText, provider, apiKey);
      } else {
        parsed = smartFallbackParse(scriptText);
      }

      // Store for Lore Tracker to pick up later
      try {
        setParsedScriptResult(parsed, scriptText);
      } catch (e) {
        // Non-fatal
        console.warn('Could not store parsed result for Lore Tracker:', e);
      }

      const result = parsedScriptToParseResult(parsed);

      if (result.pages.length === 0 || result.pages.every(p => p.panels.length === 0)) {
        setError(
          'Parser found no panels. Make sure your script uses recognizable formatting:\n' +
          '• "PAGE 1" or "Panel 1:" headers\n' +
          '• "INT./EXT." slug lines\n' +
          '• CHARACTER: Dialogue lines\n' +
          '• Or try AI mode for unformatted text'
        );
        setIsLoading(false);
        return;
      }

      onImport(result, scriptText);
    } catch (err: any) {
      console.error('Parse failed:', err);
      setError(err.message || 'Unknown error during parsing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setScriptText(ev.target?.result as string || '');
      reader.readAsText(file);
    }
  };

  // Quick stats
  const lineCount = scriptText ? scriptText.split('\n').filter(l => l.trim()).length : 0;
  const pageMatches = scriptText ? (scriptText.match(/^PAGE\s+\d+/gim) || []).length : 0;
  const panelMatches = scriptText ? (scriptText.match(/^Panel\s+\d+/gim) || []).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-stone-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">Import Script to Storyboard</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setParseMode('deterministic')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-body font-semibold text-sm transition-colors ${
                parseMode === 'deterministic'
                  ? 'bg-ink text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Pattern Match
            </button>
            <button
              onClick={() => setParseMode('llm')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-body font-semibold text-sm transition-colors ${
                parseMode === 'llm'
                  ? 'bg-ink text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Zap className="w-4 h-4" />
              AI Parse
            </button>
          </div>

          {/* Textarea */}
          <div>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={`Paste your script here...\n\nSupported formats:\n  PAGE 1\n  Panel 1: Close-up of Elias at his desk.\n  ELIAS: I've been searching for years.\n\nOr screenplay format:\n  INT. APARTMENT - NIGHT\n  ELIAS\n  I've been searching for years.`}
              className="w-full h-56 px-4 py-3 border border-stone-200 rounded font-mono text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 resize-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="cursor-pointer px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-xs font-body font-medium text-stone-600 transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Upload File
                <input ref={fileRef} type="file" accept=".txt,.fountain,.fdx" onChange={handleFile} className="hidden" />
              </label>
              {scriptText && (
                <span className="text-xs text-stone-500 font-body">
                  {lineCount} lines
                  {pageMatches > 0 && ` · ${pageMatches} page${pageMatches > 1 ? 's' : ''}`}
                  {panelMatches > 0 && ` · ${panelMatches} panel${panelMatches > 1 ? 's' : ''}`}
                </span>
              )}
            </div>
          </div>

          {/* LLM config */}
          {parseMode === 'llm' && (
            <div className="border border-stone-200 rounded-lg p-4 space-y-3">
              <p className="font-body font-semibold text-ink text-sm">AI Provider</p>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => {
                  const pm = PROVIDER_META[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body font-semibold transition-colors flex items-center gap-1.5 ${
                        provider === p
                          ? 'bg-ink text-white'
                          : pm.browserWorks
                            ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            : 'bg-stone-50 text-stone-400 hover:bg-stone-100'
                      }`}
                    >
                      {!pm.browserWorks && <Globe className="w-3 h-3 opacity-60" />}
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {!meta.browserWorks && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    {meta.label} blocks direct browser requests (CORS). Use <strong>Gemini</strong> or <strong>Claude</strong> for browser-based parsing.
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
                <p className="text-[10px] text-stone-500 mt-1">
                  Get your key at{' '}
                  <a href={meta.helpUrl} target="_blank" rel="noopener noreferrer" className="text-ember-500 hover:underline">
                    {meta.helpUrl.replace('https://', '')}
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-stone-500 font-body leading-relaxed">
            {parseMode === 'deterministic'
              ? 'Pattern mode detects PAGE/Panel headers, INT./EXT. sluglines, CHARACTER: dialogue, CAPTION/SFX lines, and standalone character names. No API key needed.'
              : 'AI mode sends your script to the selected provider for intelligent parsing. Works best for unformatted or prose-style scripts.'}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 font-body text-stone-600 hover:bg-stone-200 rounded-lg transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={isLoading || !scriptText.trim() || (parseMode === 'llm' && !apiKey.trim())}
            className="px-6 py-2 font-body font-semibold text-white bg-ink hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                {parseMode === 'llm' ? <Zap className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                Import to Storyboard
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
