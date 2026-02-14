import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { parseScriptWithLLM } from '../utils/scriptParser';
import type { ParsedScript } from '../utils/scriptParser';

interface ScriptInputProps {
  onParsed: (result: ParsedScript) => void;
}

export const ScriptInput: React.FC<ScriptInputProps> = ({ onParsed }) => {
  const [script, setScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setError(null);

    // Validate input
    if (!script.trim()) {
      setError('Please paste a script before parsing');
      return;
    }

    // Get settings from localStorage
    const provider = (localStorage.getItem('loom_provider') || 'gemini') as 'openai' | 'anthropic' | 'gemini' | 'grok' | 'deepseek';
    const apiKey = localStorage.getItem('loom_api_key') || '';
    const model = localStorage.getItem('loom_model') || undefined;

    if (!apiKey) {
      setError('Please set your API key in localStorage (key: "loom_api_key")');
      return;
    }

    setIsLoading(true);

    try {
      const result = await parseScriptWithLLM(script, provider, apiKey, model);
      onParsed(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse script';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const charCount = script.length;

  return (
    <div className="flex flex-col h-full bg-paper p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-serif text-ink mb-2">Script Input</h2>
        <p className="text-sm text-stone-600">
          Paste your raw comic script below and click "Parse & Weave" to extract structured lore data.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <div className="flex-1 relative">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your comic script here...

Example:
PAGE 1

Panel 1
Wide establishing shot. The CITY OF NEO TOKYO at night.

Panel 2
ELI: I've been searching for the ANCIENT SWORD for years.

Panel 3
CAPTION: 2045 - The year everything changed."
            className="w-full h-full p-4 font-mono text-sm border-2 border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-transparent resize-none bg-white"
            disabled={isLoading}
          />
          <div className="absolute bottom-3 right-3 text-xs text-stone-500">
            {charCount} characters
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleParse}
            disabled={isLoading || !script.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-ember-500 text-white rounded-lg hover:bg-ember-600 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Parsing...</span>
              </>
            ) : (
              <span>Parse & Weave</span>
            )}
          </button>

          {error && (
            <div className="flex-1 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg">
          <p className="text-sm text-stone-700 mb-2 font-medium">Configuration (localStorage):</p>
          <ul className="text-xs text-stone-600 space-y-1 font-mono">
            <li>• <strong>loom_provider</strong>: openai | anthropic | gemini | grok | deepseek (default: gemini)</li>
            <li>• <strong>loom_api_key</strong>: Your API key (required)</li>
            <li>• <strong>loom_model</strong>: Model override (optional, uses provider default if not set)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
