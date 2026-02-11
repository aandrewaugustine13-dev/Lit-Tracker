// =============================================================================
// PARSER TEST PAGE — Test interface for Universal Script Parser
// =============================================================================
// Standalone test page to verify the parser works correctly.

import React, { useState } from 'react';
import { useLitStore } from '../../store';
import { parseScriptAndProposeUpdates } from '../../engine/universalScriptParser';
import { ExtractionPreviewModal } from '../parser/ExtractionPreviewModal';
import { FileText, Sparkles, Cpu } from 'lucide-react';

export function ParserTestPage() {
  const [scriptText, setScriptText] = useState(SAMPLE_SCRIPT);
  const [isParsing, setIsParsing] = useState(false);
  const [enableLLM, setEnableLLM] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const characters = useLitStore((s) => s.characters);
  const normalizedLocations = useLitStore((s) => s.normalizedLocations);
  const normalizedItems = useLitStore((s) => s.normalizedItems);
  const projectConfig = useLitStore((s) => s.projectConfig);
  const currentProposal = useLitStore((s) => s.currentProposal);
  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);
  const setParserStatus = useLitStore((s) => s.setParserStatus);
  const setParserError = useLitStore((s) => s.setParserError);

  const handleParse = async () => {
    if (!scriptText.trim()) {
      alert('Please enter some script text to parse');
      return;
    }

    setIsParsing(true);
    setParserStatus('parsing');

    try {
      const proposal = await parseScriptAndProposeUpdates({
        rawScriptText: scriptText,
        config: projectConfig,
        characters,
        normalizedLocations,
        normalizedItems,
        geminiApiKey: enableLLM ? apiKey : undefined,
        enableLLM,
      });

      setCurrentProposal(proposal);
    } catch (error) {
      console.error('Parser error:', error);
      setParserError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCloseModal = () => {
    setCurrentProposal(null);
  };

  return (
    <div className="min-h-screen bg-paper p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-ink mb-2">
            Universal Script Parser Test
          </h1>
          <p className="text-steel-300">
            Test the two-pass extraction engine for screenplay/comic script parsing
          </p>
        </div>

        {/* Config Section */}
        <div className="bg-card border border-stone-200 rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-display font-semibold text-ink mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableLLM"
                checked={enableLLM}
                onChange={(e) => setEnableLLM(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-ember-500"
              />
              <label htmlFor="enableLLM" className="flex items-center gap-2 text-steel-200">
                <Sparkles className="w-4 h-4" />
                Enable AI-assisted extraction (Pass 2)
              </label>
            </div>

            {enableLLM && (
              <div>
                <label className="block text-sm font-medium text-steel-200 mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ember-500"
                />
              </div>
            )}
          </div>
        </div>

        {/* Script Input */}
        <div className="bg-card border border-stone-200 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold text-ink">Script Input</h2>
            <button
              onClick={() => setScriptText(SAMPLE_SCRIPT)}
              className="text-sm text-ember-600 hover:text-ember-700"
            >
              Load Sample Script
            </button>
          </div>
          
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Paste your screenplay or comic script here..."
            className="w-full h-96 px-4 py-3 font-mono text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ember-500 resize-none"
          />
          
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-steel-400">
              {scriptText.split('\n').length} lines • {scriptText.length} characters
            </div>
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="px-6 py-2.5 text-sm font-medium text-white bg-ember-500 rounded-lg hover:bg-ember-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isParsing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Parse Script
                </>
              )}
            </button>
          </div>
        </div>

        {/* Existing Data Summary */}
        <div className="bg-card border border-stone-200 rounded-2xl p-6">
          <h2 className="text-xl font-display font-semibold text-ink mb-4">
            Existing Database
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-ink">{characters.length}</div>
              <div className="text-sm text-steel-300">Characters</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-ink">{normalizedLocations.ids.length}</div>
              <div className="text-sm text-steel-300">Locations</div>
            </div>
            <div className="bg-stone-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-ink">{normalizedItems.ids.length}</div>
              <div className="text-sm text-steel-300">Items</div>
            </div>
          </div>
        </div>
      </div>

      {/* Extraction Preview Modal */}
      {currentProposal && (
        <ExtractionPreviewModal onClose={handleCloseModal} />
      )}
    </div>
  );
}

// ─── Sample Script for Testing ──────────────────────────────────────────────

const SAMPLE_SCRIPT = `Page 1

INT. ABANDONED WAREHOUSE - NIGHT

Panel 1 Interior abandoned warehouse. Moonlight streams through broken windows.

ELI stands in the center, holding a MYSTERIOUS ORB. The orb glows faintly.

ELI
(whispers)
This is it. The Artifact of Ages.

Panel 2 Close on ELI's face. Determination in his eyes.

ELI
They said it was a myth. But here it is.

Panel 3 Exterior warehouse. MAYA approaches on a motorcycle.

CAPTION: Two years ago

Panel 4 Interior. MAYA enters, draws a SILVER BLADE.

MAYA
Put it down, Eli. That thing doesn't belong to you.

ELI
Maya? I thought you were--

Panel 5 Wide angle. They face each other across the warehouse.

MAYA
Dead? No. But you will be if you don't hand over that orb.

Setting: Ancient Rome, 44 BC

Page 2

INT. TEMPLE OF JUPITER - DAY

Panel 1 Interior temple. SENATOR MARCUS holds a GOLDEN DAGGER.

MARCUS
The time has come.

Panel 2 Exterior temple. BRUTUS arrives.

BRUTUS
Is it done?

MARCUS
Not yet. But soon.
`;
