import React, { useState } from 'react';
import { X, Upload, Sparkles } from 'lucide-react';
import { useLitStore } from '../../store';
import { parseScriptAndProposeUpdates } from '../../engine/universalScriptParser';
import { parseScriptWithLLM } from '../../utils/scriptParser';

// =============================================================================
// SCRIPT EXTRACTION TRIGGER — Modal for inputting script text and triggering parser
// =============================================================================

interface ScriptExtractionTriggerProps {
  onClose: () => void;
}

export const ScriptExtractionTrigger: React.FC<ScriptExtractionTriggerProps> = ({ onClose }) => {
  const [scriptText, setScriptText] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [enableLLM, setEnableLLM] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const projectConfig = useLitStore((s) => s.projectConfig);
  const characters = useLitStore((s) => s.characters);
  const normalizedLocations = useLitStore((s) => s.normalizedLocations);
  const normalizedItems = useLitStore((s) => s.normalizedItems);
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);
  const setParserStatus = useLitStore((s) => s.setParserStatus);
  const setParserError = useLitStore((s) => s.setParserError);
  const setParsedScriptResult = useLitStore((s) => s.setParsedScriptResult);

  const handleParse = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('Please enter script text to parse');
      return;
    }

    setIsLoading(true);
    setParserStatus('parsing');
    setErrorMessage(null);

    try {
      // 1. Parse for lore entities (characters, locations, items, timeline)
      const proposal = await parseScriptAndProposeUpdates({
        rawScriptText: scriptText,
        config: projectConfig,
        characters,
        normalizedLocations,
        normalizedItems,
        geminiApiKey: enableLLM ? geminiApiKey : undefined,
        enableLLM,
      });

      setCurrentProposal(proposal);
      
      // 2. Also parse for pages/panels/dialogue structure (for Ink Tracker)
      // This runs in parallel and stores the result for later use by Ink Tracker
      if (enableLLM && geminiApiKey) {
        try {
          const parsedScript = await parseScriptWithLLM(
            scriptText,
            'gemini',
            geminiApiKey
          );
          setParsedScriptResult(parsedScript, scriptText);
        } catch (scriptError) {
          console.error('Failed to parse script structure:', scriptError);
          // Don't fail the whole operation if this fails
          // User can still get lore extraction results
        }
      }
      
      onClose(); // Close this modal, the ExtractionPreviewModal will show
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-card border-stone-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-ember-500" />
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
            {/* Instructions */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-700">
              <p className="font-body mb-2">
                <strong>How it works:</strong> Paste your script text below, and the parser will extract:
              </p>
              <ul className="list-disc list-inside space-y-1 text-stone-600 ml-2">
                <li>Characters (from dialogue speakers and mentions)</li>
                <li>Locations (from slug-lines and scene headings)</li>
                <li>Items (from action descriptions)</li>
                <li>Timeline events (character movements, item transfers)</li>
              </ul>
              <p className="mt-3 text-stone-600">
                The parser uses deterministic pattern matching by default. Enable LLM for advanced entity extraction.
              </p>
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
                className="w-full h-64 px-4 py-3 border border-stone-200 rounded-lg font-mono text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500/20 resize-none"
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
                <span className="text-xs text-stone-500">
                  {scriptText ? `${scriptText.length} characters` : 'No text entered'}
                </span>
              </div>
            </div>

            {/* LLM Options */}
            <div className="border border-stone-200 rounded-lg p-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableLLM}
                  onChange={(e) => setEnableLLM(e.target.checked)}
                  className="w-4 h-4 text-ember-500 border-stone-300 rounded focus:ring-ember-500"
                />
                <span className="font-body font-semibold text-ink">
                  Enable LLM-Enhanced Extraction (Optional)
                </span>
              </label>
              <p className="text-xs text-stone-600 mt-1 ml-6">
                Use Gemini AI to extract implicit relationships, emotional states, and complex entity interactions.
              </p>
              
              {enableLLM && (
                <div className="mt-3 ml-6">
                  <label className="block text-sm font-body font-medium text-ink mb-1">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:border-ember-500 focus:ring-1 focus:ring-ember-500/20"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Get your free API key at{' '}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ember-500 hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              )}
            </div>
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
            className="px-6 py-2 font-body font-semibold text-white bg-ember-500 hover:bg-ember-600 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Parse Script
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
