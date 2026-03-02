import React, { useState } from 'react';
import { X, Upload, Zap, HardDrive } from 'lucide-react';
import { useLitStore } from '../../store';
import { parseScript } from '../../engine/parserPipeline';
import type { UnifiedParseResult } from '../../engine/parserPipeline.types';
import type { ParsedProposal, ProposedNewEntity, ProposedTimelineEvent, ProposedEntityType } from '../../types/parserTypes';
import { isGoogleDriveConfigured } from '../../services/googleDrive';
import { DriveFilePicker } from '../shared/DriveFilePicker';

// =============================================================================
// SCRIPT EXTRACTION TRIGGER — AI-only parser modal
// =============================================================================
// Runs the unified AI pipeline and converts the result into a ParsedProposal
// for the extraction review UI. No deterministic parser. No silent fallbacks.

interface ScriptExtractionTriggerProps {
  onClose: () => void;
}

type ProviderOption = 'anthropic' | 'gemini' | 'openai' | 'grok' | 'deepseek' | 'groq';

const PROVIDER_META: Record<ProviderOption, { label: string; placeholder: string; helpUrl: string; browserWorks: boolean }> = {
  anthropic: { label: 'Claude', placeholder: 'sk-ant-...', helpUrl: 'https://console.anthropic.com/settings/keys', browserWorks: true },
  gemini:    { label: 'Gemini', placeholder: 'AIza...', helpUrl: 'https://aistudio.google.com/apikey', browserWorks: true },
  groq:      { label: 'Groq', placeholder: 'gsk_...', helpUrl: 'https://console.groq.com/keys', browserWorks: false },
  openai:    { label: 'OpenAI', placeholder: 'sk-...', helpUrl: 'https://platform.openai.com/api-keys', browserWorks: false },
  grok:      { label: 'Grok', placeholder: 'xai-...', helpUrl: 'https://console.x.ai', browserWorks: false },
  deepseek:  { label: 'DeepSeek', placeholder: 'sk-...', helpUrl: 'https://platform.deepseek.com/api_keys', browserWorks: false },
};

const PROVIDERS: ProviderOption[] = ['anthropic', 'gemini', 'groq', 'openai', 'grok', 'deepseek'];

// ─── Conversion: UnifiedParseResult → ParsedProposal ────────────────────────

let _tempIdCounter = 0;
function tempId(): string {
  return 'tmp-' + Date.now() + '-' + (++_tempIdCounter);
}

/** Map lore category to proposal entity type (direct 1:1 mapping) */
function loreCategoryToEntityType(category: string): ProposedEntityType {
  const map: Record<string, ProposedEntityType> = {
    faction: 'faction',
    location: 'location',
    event: 'event',
    concept: 'concept',
    artifact: 'artifact',
    rule: 'rule',
    item: 'item',
  };
  return map[category] || 'item';
}

function unifiedResultToProposal(result: UnifiedParseResult, scriptText: string, startTime: number): ParsedProposal {
  const newEntities: ProposedNewEntity[] = [];

  // ── Characters → ProposedNewEntity ──
  for (const char of result.characters) {
    newEntities.push({
      tempId: tempId(),
      entityType: 'character',
      name: char.name,
      source: 'llm',
      confidence: 0.9,
      contextSnippet: char.notable_quotes?.[0] || char.description || '',
      lineNumber: 0,
      suggestedRole: char.role || 'Supporting',
      suggestedDescription: char.description || '',
    });
  }

  // ── Lore → ProposedNewEntity ──
  for (const lore of result.lore) {
    const entity: ProposedNewEntity = {
      tempId: tempId(),
      entityType: loreCategoryToEntityType(lore.category),
      name: lore.name,
      source: 'llm',
      confidence: lore.confidence,
      contextSnippet: lore.description,
      lineNumber: 0,
      suggestedLoreType: lore.category,
      suggestedDescription: lore.description,
    };

    // Category-specific fields
    if (lore.category === 'faction' && lore.related_characters?.length) {
      entity.suggestedLeader = lore.related_characters[0];
    }
    if (lore.category === 'artifact' || lore.category === 'concept') {
      entity.suggestedOrigin = lore.description;
    }
    if (lore.metadata) {
      entity.suggestedTags = Object.keys(lore.metadata);
    }

    newEntities.push(entity);
  }

  // ── Timeline → ProposedTimelineEvent ──
  const newTimelineEvents: ProposedTimelineEvent[] = result.timeline.map(evt => ({
    tempId: tempId(),
    source: 'llm' as const,
    confidence: 0.85,
    contextSnippet: evt.description,
    lineNumber: 0,
    entityType: 'character' as const,
    entityId: '',
    entityName: evt.characters_involved[0] || evt.name,
    action: 'status_changed' as const,
    payload: {
      page: evt.page,
      characters: evt.characters_involved,
      eventName: evt.name,
    },
    description: evt.description,
  }));

  return {
    meta: {
      parsedAt: new Date().toISOString(),
      rawScriptLength: scriptText.length,
      lineCount: scriptText.split('\n').length,
      parseDurationMs: Date.now() - startTime,
      llmWasUsed: true,
      warnings: result.warnings,
    },
    newEntities,
    updatedEntities: [],
    newTimelineEvents,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ScriptExtractionTrigger: React.FC<ScriptExtractionTriggerProps> = ({ onClose }) => {
  const [scriptText, setScriptText] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<ProviderOption>('gemini');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const setCurrentProposal = useLitStore((s) => s.setCurrentProposal);
  const setParserStatus = useLitStore((s) => s.setParserStatus);
  const setParserError = useLitStore((s) => s.setParserError);
  const setParsedScriptResult = useLitStore((s) => s.setParsedScriptResult);
  const inkState = useLitStore((s) => s.inkState);
  const activeProject = inkState.projects.find(
    (p: any) => p.id === inkState.activeProjectId,
  );

  const meta = PROVIDER_META[provider];

  const handleParse = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('Please enter script text to parse');
      return;
    }
    if (!apiKey.trim()) {
      setErrorMessage('Please enter your API key');
      return;
    }
    if (!meta.browserWorks) {
      setErrorMessage(
        `${meta.label} blocks direct browser requests (CORS). Use Gemini or Claude instead, or run the app through a proxy server.`
      );
      return;
    }

    setIsLoading(true);
    setParserStatus('parsing');
    setErrorMessage(null);
    const startTime = Date.now();

    try {
      // ═══ SINGLE STEP: AI Parse → Proposal ═══
      console.log('[ScriptExtraction] Running AI-only pipeline with', provider);

      const unifiedResult = await parseScript({
        scriptText,
        projectType: activeProject?.projectType || 'comic',
        llmProvider: provider,
        llmApiKey: apiKey,
        extractionOnly: true,
      });

      console.log('[ScriptExtraction] AI parse complete:', {
        pages: unifiedResult.pages.length,
        characters: unifiedResult.characters.length,
        lore: unifiedResult.lore.length,
        timeline: unifiedResult.timeline.length,
        source: unifiedResult.parser_source,
      });

      // Store for Ink Tracker
      try {
        setParsedScriptResult(unifiedResult, scriptText);
      } catch (storeError) {
        console.warn('[ScriptExtraction] Failed to store parse result:', storeError);
      }

      // Convert to proposal for extraction review UI
      const proposal = unifiedResultToProposal(unifiedResult, scriptText, startTime);

      console.log('[ScriptExtraction] Proposal created:', {
        newEntities: proposal.newEntities.length,
        characters: proposal.newEntities.filter(e => e.entityType === 'character').length,
        factions: proposal.newEntities.filter(e => e.entityType === 'faction').length,
        locations: proposal.newEntities.filter(e => e.entityType === 'location').length,
        events: proposal.newEntities.filter(e => e.entityType === 'event').length,
        concepts: proposal.newEntities.filter(e => e.entityType === 'concept').length,
        artifacts: proposal.newEntities.filter(e => e.entityType === 'artifact').length,
        timelineEvents: proposal.newTimelineEvents.length,
      });

      setCurrentProposal(proposal);
      setParserStatus('idle');
      onClose();
    } catch (error) {
      console.error('[ScriptExtraction] Parse failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown parsing error';
      setParserError(errorMsg);
      setErrorMessage(`Parsing failed: ${errorMsg}`);
      setParserStatus('error');
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
            {/* Instructions */}
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-sm text-stone-700">
              <p className="font-body mb-2">
                <strong>How it works:</strong> Paste your script text below. The AI parser will extract:
              </p>
              <ul className="list-disc list-inside space-y-1 text-stone-600 ml-2">
                <li>Characters (from dialogue and action)</li>
                <li>Locations (settings, named places)</li>
                <li>Factions and Organizations</li>
                <li>Events and significant moments</li>
                <li>Concepts, powers, and phenomena</li>
                <li>Artifacts and significant objects</li>
                <li>World rules and mechanics</li>
                <li>Timeline events</li>
              </ul>
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
                placeholder="Paste your script text here..."
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

            {/* Provider & API Key */}
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
                    {meta.label} blocks direct browser requests (CORS). Use Gemini or Claude for now.
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
            disabled={isLoading || !scriptText.trim() || !apiKey.trim()}
            className="px-6 py-2 font-body font-semibold text-white bg-ink hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
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
