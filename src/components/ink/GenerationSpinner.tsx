import React, { useState, useEffect } from 'react';
import { ImageProvider } from '../../types';

/* ------------------------------------------------------------------ */
/*  Provider-specific display names and colors                        */
/* ------------------------------------------------------------------ */

const PROVIDER_META: Record<ImageProvider, { label: string; color: string; bgColor: string }> = {
    gemini:   { label: 'Gemini',   color: 'text-blue-400',   bgColor: 'border-blue-500' },
    leonardo: { label: 'Leonardo', color: 'text-orange-400', bgColor: 'border-orange-500' },
    grok:     { label: 'Grok',     color: 'text-gray-400',   bgColor: 'border-gray-500' },
    fal:      { label: 'FAL Flux', color: 'text-ember-400',  bgColor: 'border-ember-500' },
    seaart:   { label: 'SeaArt',   color: 'text-pink-400',   bgColor: 'border-pink-500' },
    openai:   { label: 'OpenAI',   color: 'text-green-400',  bgColor: 'border-green-500' },
};

/* Rotating messages to keep users engaged while waiting */
const GENERATION_TIPS: string[] = [
    'Composing the scene...',
    'Balancing lights and shadows...',
    'Rendering character details...',
    'Applying art style...',
    'Refining composition...',
    'Adding atmospheric depth...',
    'Inking the final lines...',
];

/* ------------------------------------------------------------------ */
/*  Panel-level generation overlay                                    */
/* ------------------------------------------------------------------ */

interface PanelSpinnerProps {
    provider: ImageProvider;
}

/**
 * Full-overlay spinner for a single PanelCard while generating.
 * Shows provider name, animated ring, and rotating status tips.
 */
export const PanelGenerationOverlay: React.FC<PanelSpinnerProps> = ({ provider }) => {
    const meta = PROVIDER_META[provider];
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % GENERATION_TIPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-10 rounded-lg">
            {/* Animated spinner ring with provider accent */}
            <div className={`w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin ${meta.bgColor}`} />
            <p className={`text-xs font-body font-bold uppercase tracking-widest ${meta.color}`}>
                Generating with {meta.label}
            </p>
            <p className="text-[10px] text-stone-400 font-body animate-pulse max-w-[200px] text-center">
                {GENERATION_TIPS[tipIndex]}
            </p>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Batch / "Generate All" progress bar                               */
/* ------------------------------------------------------------------ */

interface BatchProgressProps {
    provider: ImageProvider;
    current: number;
    total: number;
    onCancel: () => void;
}

/**
 * Inline progress indicator for batch "Auto-Ink" and "Generate All".
 * Shows provider, progress bar, panel count, and cancel.
 */
export const BatchProgressIndicator: React.FC<BatchProgressProps> = ({
    provider,
    current,
    total,
    onCancel,
}) => {
    const meta = PROVIDER_META[provider];
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % GENERATION_TIPS.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center gap-2 min-w-[220px]">
            {/* Provider label */}
            <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full border-2 border-t-transparent animate-spin ${meta.bgColor}`} />
                <span className={`text-[10px] font-body font-bold uppercase tracking-widest ${meta.color}`}>
                    Generating with {meta.label}
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, var(--tw-gradient-stops))`,
                        // Fallback inline color
                        backgroundColor: provider === 'gemini' ? '#60a5fa'
                            : provider === 'leonardo' ? '#fb923c'
                            : provider === 'grok' ? '#9ca3af'
                            : provider === 'fal' ? '#f97316'
                            : provider === 'seaart' ? '#f472b6'
                            : '#4ade80',
                    }}
                />
            </div>

            {/* Count + tip */}
            <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-body text-stone-600">
                    Panel {current}/{total}
                </span>
                <span className="text-[9px] font-body text-stone-500">
                    {percent}%
                </span>
            </div>

            {/* Rotating tip */}
            <p className="text-[9px] text-stone-500 font-body italic text-center">
                {GENERATION_TIPS[tipIndex]}
            </p>

            {/* Cancel */}
            <button
                onClick={onCancel}
                className="text-[10px] font-body text-red-600 hover:text-red-500 uppercase tracking-widest transition-colors"
            >
                Cancel
            </button>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Script-parsing progress                                           */
/* ------------------------------------------------------------------ */

interface ScriptParsingProps {
    stage: 'reading' | 'parsing' | 'extracting-characters' | 'building-pages' | 'done';
    projectType?: string;
}

const STAGE_LABELS: Record<ScriptParsingProps['stage'], string> = {
    reading: 'Reading script...',
    parsing: 'Parsing structure...',
    'extracting-characters': 'Extracting characters...',
    'building-pages': 'Building storyboard pages...',
    done: 'Complete!',
};

const STAGE_ORDER: ScriptParsingProps['stage'][] = [
    'reading',
    'parsing',
    'extracting-characters',
    'building-pages',
    'done',
];

/**
 * Multi-step progress for script parsing / import.
 */
export const ScriptParsingProgress: React.FC<ScriptParsingProps> = ({ stage, projectType }) => {
    const currentIdx = STAGE_ORDER.indexOf(stage);
    const formatLabel = projectType === 'screenplay' ? 'Screenplay'
        : projectType === 'stage-play' ? 'Stage Play'
        : projectType === 'tv-series' ? 'TV Script'
        : 'Comic Script';

    return (
        <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-10 h-10 rounded-full border-[3px] border-ink border-t-transparent animate-spin" />
            <p className="text-sm font-body text-ink font-bold uppercase tracking-widest">
                Parsing {formatLabel}
            </p>

            {/* Step indicators */}
            <div className="flex flex-col gap-2 w-64">
                {STAGE_ORDER.filter(s => s !== 'done').map((s, idx) => {
                    const isDone = idx < currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all ${
                                isDone
                                    ? 'bg-green-600 text-white'
                                    : isCurrent
                                        ? 'bg-ink text-white animate-pulse'
                                        : 'bg-stone-200 text-stone-500'
                            }`}>
                                {isDone ? '✓' : idx + 1}
                            </div>
                            <span className={`text-xs font-body transition-colors ${
                                isDone ? 'text-green-600' : isCurrent ? 'text-ink' : 'text-stone-500'
                            }`}>
                                {STAGE_LABELS[s]}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/*  Status bar messages (bottom bar of App)                           */
/* ------------------------------------------------------------------ */

interface StatusBarProps {
    batching: boolean;
    exporting: boolean;
    isGeneratingAll: boolean;
    provider?: ImageProvider;
    currentPanel?: number;
    totalPanels?: number;
    showGutters?: boolean;
}

/**
 * Rich status indicator for the bottom bar.
 */
export const StatusBarIndicator: React.FC<StatusBarProps> = ({
    batching,
    exporting,
    isGeneratingAll,
    provider,
    currentPanel = 0,
    totalPanels = 0,
    showGutters = false,
}) => {
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % GENERATION_TIPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const isActive = batching || exporting || isGeneratingAll;
    const meta = provider ? PROVIDER_META[provider] : null;

    if (!isActive) {
        return (
            <>
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="text-[10px] font-body uppercase tracking-[0.3em] font-bold">
                    Terminal Ready
                </span>
            </>
        );
    }

    if (exporting) {
        return (
            <>
                <div className="w-3 h-3 rounded-full bg-blue-600 animate-ping" />
                <span className="text-[10px] font-body uppercase tracking-[0.3em] font-bold">
                    Exporting...
                </span>
            </>
        );
    }

    // Batching or generating all
    const percent = totalPanels > 0 ? Math.round((currentPanel / totalPanels) * 100) : 0;

    return (
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-ping ${
                meta ? '' : 'bg-ink'
            }`} style={meta ? { backgroundColor: provider === 'gemini' ? '#60a5fa'
                : provider === 'leonardo' ? '#fb923c'
                : provider === 'grok' ? '#9ca3af'
                : provider === 'fal' ? '#f97316'
                : provider === 'seaart' ? '#f472b6'
                : '#4ade80' } : undefined}
            />
            <div className="flex flex-col">
                <span className={`text-[10px] font-body uppercase tracking-[0.2em] font-bold ${meta?.color || 'text-ink'}`}>
                    {isGeneratingAll
                        ? `Generating with ${meta?.label || 'AI'} (${currentPanel}/${totalPanels})`
                        : batching
                            ? `Auto-inking with ${meta?.label || 'AI'}...`
                            : 'Processing...'}
                </span>
                {isGeneratingAll && totalPanels > 0 && (
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className={`h-1 rounded-full overflow-hidden flex-1 ${showGutters ? 'bg-stone-300' : 'bg-stone-200'}`} style={{ width: 80 }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${percent}%`,
                                    backgroundColor: provider === 'gemini' ? '#60a5fa'
                                        : provider === 'leonardo' ? '#fb923c'
                                        : provider === 'grok' ? '#9ca3af'
                                        : provider === 'fal' ? '#f97316'
                                        : provider === 'seaart' ? '#f472b6'
                                        : '#4ade80',
                                }}
                            />
                        </div>
                        <span className="text-[9px] font-body text-stone-600">{percent}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};
