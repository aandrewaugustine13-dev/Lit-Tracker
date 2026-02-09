import React from 'react';

/**
 * Reusable empty-state placeholder with personality.
 * Shows an inline SVG illustration, heading, description, and optional tips/actions.
 */

interface EmptyStateProps {
    variant: 'projects' | 'panels' | 'characters' | 'cast' | 'issues' | 'page-spread';
    showGutters?: boolean;
    onAction?: () => void;
    actionLabel?: string;
    compact?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Inline SVG illustrations – small, thematic, hand-crafted          */
/* ------------------------------------------------------------------ */

const IllustrationProjects = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stack of comic book pages */}
        <rect x="20" y="30" width="50" height="65" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.3" />
        <rect x="28" y="22" width="50" height="65" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
        <rect x="36" y="14" width="50" height="65" rx="3" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.05" />
        {/* Panel lines on front page */}
        <line x1="36" y1="40" x2="86" y2="40" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1="60" y1="14" x2="60" y2="79" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        {/* Sparkle */}
        <path d="M98 20l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" fill="currentColor" opacity="0.6" />
        <path d="M14 50l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4z" fill="currentColor" opacity="0.4" />
    </svg>
);

const IllustrationPanels = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Large empty frame with dashed border */}
        <rect x="20" y="15" width="120" height="85" rx="4" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" opacity="0.3" />
        {/* Comic panel grid suggestion */}
        <rect x="30" y="25" width="45" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <rect x="80" y="25" width="50" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <rect x="30" y="60" width="100" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        {/* Pencil icon */}
        <g transform="translate(75, 42) rotate(-45)" opacity="0.7">
            <rect x="0" y="0" width="4" height="18" rx="1" fill="currentColor" fillOpacity="0.3" />
            <polygon points="0,18 2,24 4,18" fill="currentColor" fillOpacity="0.5" />
        </g>
        {/* Action burst */}
        <path d="M148 10l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5 1.5-4.5z" fill="currentColor" opacity="0.4" />
    </svg>
);

const IllustrationCharacters = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Character silhouette 1 */}
        <circle cx="40" cy="35" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        <path d="M22 72c0-10 8-18 18-18s18 8 18 18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        {/* Character silhouette 2 */}
        <circle cx="75" cy="30" r="14" stroke="currentColor" strokeWidth="2" opacity="0.6" />
        <path d="M55 72c0-12 9-20 20-20s20 8 20 20" stroke="currentColor" strokeWidth="2" opacity="0.6" />
        {/* Question mark */}
        <text x="73" y="37" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor" opacity="0.5">?</text>
        {/* Sparkles */}
        <path d="M105 22l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4z" fill="currentColor" opacity="0.5" />
        <path d="M10 55l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor" opacity="0.3" />
    </svg>
);

const IllustrationIssues = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stacked pages */}
        <rect x="8" y="12" width="28" height="38" rx="2" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" opacity="0.3" />
        <rect x="14" y="6" width="28" height="38" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        {/* Lines representing text/content */}
        <line x1="18" y1="14" x2="38" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1="18" y1="19" x2="34" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <line x1="18" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        {/* Plus sign */}
        <circle cx="58" cy="30" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
        <line x1="58" y1="24" x2="58" y2="36" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="52" y1="30" x2="64" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
);

/* ------------------------------------------------------------------ */
/*  Content config per variant                                        */
/* ------------------------------------------------------------------ */

interface VariantConfig {
    illustration: React.FC<{ className?: string }>;
    title: string;
    description: string;
    tips: string[];
    actionDefault?: string;
}

const VARIANT_CONFIG: Record<EmptyStateProps['variant'], VariantConfig> = {
    projects: {
        illustration: IllustrationProjects,
        title: 'Your stories begin here',
        description: 'Every great comic starts with a blank page. Create your first project to set up your style, characters, and storyboard.',
        tips: [
            'Each project holds its own art style and API keys',
            'Import a script or build panels from scratch',
            'Characters you define carry across every panel',
        ],
        actionDefault: 'Create First Project',
    },
    panels: {
        illustration: IllustrationPanels,
        title: 'Empty page',
        description: 'Add a frame to get started.',
        tips: [],
        actionDefault: 'Add Frame',
    },
    characters: {
        illustration: IllustrationCharacters,
        title: 'Your cast awaits',
        description: 'Define your characters once and they stay consistent across every panel. The more detail you add, the better the AI maintains their look.',
        tips: [
            'Add physical details like hair color, build, and clothing',
            'Characters are automatically woven into generation prompts',
            'Assign characters to specific panels for consistency',
        ],
        actionDefault: 'Add First Character',
    },
    cast: {
        illustration: IllustrationCharacters,
        title: 'No cast yet',
        description: 'Add characters to maintain visual consistency across panels.',
        tips: [
            'Click + to add a character with their description',
            'Open Character Bank for detailed appearance fields',
        ],
    },
    issues: {
        illustration: IllustrationIssues,
        title: 'No chapters yet',
        description: 'Create your first issue or chapter to start organizing your story into pages.',
        tips: [
            'Click + to create an issue or chapter',
            'Each issue holds multiple pages of panels',
        ],
    },
    'page-spread': {
        illustration: IllustrationPanels,
        title: 'Empty page',
        description: 'Add frames to bring this page to life.',
        tips: [],
    },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const EmptyState: React.FC<EmptyStateProps> = ({
    variant,
    showGutters = false,
    onAction,
    actionLabel,
    compact = false,
}) => {
    const config = VARIANT_CONFIG[variant];
    const Illustration = config.illustration;

    // Compact variant for sidebar sections
    if (compact) {
        return (
            <div className={`flex flex-col items-center text-center py-6 px-3 rounded-xl border border-dashed transition-colors ${
                showGutters ? 'border-gray-300 bg-gray-50' : 'border-ink-700 bg-ink-800/30'
            }`}>
                <Illustration className={`w-16 h-12 mb-3 ${showGutters ? 'text-gray-400' : 'text-steel-600'}`} />
                <p className={`font-mono text-[10px] uppercase tracking-widest mb-1 ${
                    showGutters ? 'text-gray-500' : 'text-steel-500'
                }`}>
                    {config.title}
                </p>
                <p className={`text-[10px] leading-relaxed mb-3 max-w-[200px] ${
                    showGutters ? 'text-gray-400' : 'text-steel-600'
                }`}>
                    {config.description}
                </p>
                {config.tips.length > 0 && (
                    <ul className="space-y-1 mb-3">
                        {config.tips.map((tip, i) => (
                            <li key={i} className={`text-[9px] flex items-start gap-1.5 text-left ${
                                showGutters ? 'text-gray-400' : 'text-steel-700'
                            }`}>
                                <span className={`mt-0.5 w-1 h-1 rounded-full flex-shrink-0 ${
                                    showGutters ? 'bg-gray-400' : 'bg-ember-500/50'
                                }`} />
                                {tip}
                            </li>
                        ))}
                    </ul>
                )}
                {onAction && (
                    <button
                        onClick={onAction}
                        className="mt-1 px-4 py-1.5 text-[9px] font-mono uppercase tracking-widest rounded-lg border transition-all hover:scale-105 active:scale-95 bg-ember-500/10 text-ember-500 border-ember-500/30 hover:bg-ember-500/20"
                    >
                        {actionLabel || config.actionDefault || 'Get Started'}
                    </button>
                )}
            </div>
        );
    }

    // Full-size variant for main content areas
    return (
        <div className="flex flex-col items-center justify-center text-center animate-fade-in select-none py-12">
            <Illustration className={`mb-8 ${
                variant === 'panels' ? 'w-48 h-36' : 'w-36 h-28'
            } ${showGutters ? 'text-gray-400' : 'text-steel-600'}`} />

            <h2 className={`font-display text-3xl tracking-widest uppercase mb-3 ${
                showGutters ? 'text-gray-400' : 'text-ink-600'
            }`}>
                {config.title}
            </h2>

            <p className={`text-sm max-w-md leading-relaxed mb-6 ${
                showGutters ? 'text-gray-400' : 'text-steel-600'
            }`}>
                {config.description}
            </p>

            {config.tips.length > 0 && (
                <div className={`rounded-xl border px-6 py-4 mb-6 max-w-sm ${
                    showGutters ? 'border-gray-300 bg-gray-50' : 'border-ink-800 bg-ink-900/60'
                }`}>
                    <p className={`text-[10px] font-mono uppercase tracking-widest mb-3 ${
                        showGutters ? 'text-gray-500' : 'text-steel-500'
                    }`}>
                        Quick tips
                    </p>
                    <ul className="space-y-2 text-left">
                        {config.tips.map((tip, i) => (
                            <li key={i} className={`text-xs flex items-start gap-2 ${
                                showGutters ? 'text-gray-500' : 'text-steel-500'
                            }`}>
                                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    showGutters ? 'bg-gray-400' : 'bg-ember-500/60'
                                }`} />
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {onAction && (
                <button
                    onClick={onAction}
                    className={`px-8 py-3 font-display text-lg tracking-widest uppercase rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${
                        showGutters
                            ? 'bg-black text-white hover:bg-gray-800'
                            : 'bg-ember-500 hover:bg-ember-400 text-ink-950'
                    }`}
                >
                    {actionLabel || config.actionDefault || 'Get Started'}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
