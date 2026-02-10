import React, { useState } from 'react';
import { parseScript, ParseResult, VisualMarker } from '../../services/scriptParser';
import { parseScreenplay } from '../../services/screenplayParser';
import { parseStagePlay } from '../../services/stagePlayParser';
import { parseTVScript } from '../../services/tvSeriesParser';
import { Project } from '../../types';
import { ScriptParsingProgress } from './GenerationSpinner';

interface Props {
    project: Project;
    onClose: () => void;
    onImport: (result: ParseResult, scriptText: string) => void;
}

const MARKER_COLORS: Record<VisualMarker, string> = {
    standard: 'text-steel-400',
    echo: 'text-red-500',
    hitch: 'text-cyan-500',
    overflow: 'text-purple-500',
    shattered: 'text-red-400',
    split: 'text-amber-500',
    splash: 'text-emerald-500',
    inset: 'text-sky-400',
    large: 'text-lime-500',
    'full-width': 'text-pink-500',
};

export function ScriptImportModal({ project, onClose, onImport }: Props) {
    const [script, setScript] = useState('');
    const [result, setResult] = useState<ParseResult | null>(null);
    const [editableCharacters, setEditableCharacters] = useState<ParseResult['characters']>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [parseStage, setParseStage] = useState<'reading' | 'parsing' | 'extracting-characters' | 'building-pages' | 'done'>('reading');

    const handleParse = async () => {
        setIsParsing(true);
        setParseStage('reading');

        // Small delay so user sees progress stages
        await new Promise(r => setTimeout(r, 300));
        setParseStage('parsing');

        let parsed: ParseResult;
        
        // Select the appropriate parser based on project type
        switch (project.projectType) {
            case 'screenplay':
                // parseScreenplay returns a different format, we need to adapt it
                const screenplayResult = parseScreenplay(script);
                parsed = {
                    success: screenplayResult.errors.length === 0 || screenplayResult.pages.length > 0,
                    pages: screenplayResult.pages.map(page => ({
                        pageNumber: page.pageNumber,
                        panels: page.panels.map(panel => ({
                            panelNumber: panel.panelNumber,
                            description: panel.description,
                            bubbles: panel.dialogue.map(d => ({
                                type: d.type === 'spoken' ? 'dialogue' as const : 
                                      d.type === 'voiceover' ? 'caption' as const :
                                      d.type as 'dialogue' | 'caption' | 'thought' | 'sfx' | 'screen-text' | 'phone',
                                text: d.text,
                                character: d.character,
                                modifier: d.parenthetical
                            })),
                            artistNotes: panel.artistNotes ? [panel.artistNotes] : [],
                            visualMarker: (panel.visualMarker || 'standard') as VisualMarker,
                            aspectRatio: 'wide' as any // Screenplays default to 16:9/wide
                        })),
                        pageNotes: page.location ? `${page.sceneType || ''} ${page.location} - ${page.timeOfDay || ''}`.trim() : undefined
                    })),
                    characters: screenplayResult.characters.map(c => ({
                        name: c.name,
                        lineCount: c.panelCount,
                        description: c.description
                    })),
                    errors: screenplayResult.errors.map(e => e.message),
                    warnings: []
                };
                break;
                
            case 'stage-play':
                const stageResult = parseStagePlay(script);
                parsed = {
                    success: stageResult.errors.length === 0 || stageResult.pages.length > 0,
                    pages: stageResult.pages.map(page => ({
                        pageNumber: page.pageNumber,
                        panels: page.panels.map(panel => ({
                            panelNumber: panel.panelNumber,
                            description: panel.description,
                            bubbles: panel.dialogue.map(d => ({
                                type: d.type === 'spoken' ? 'dialogue' as const : 
                                      d.type === 'voiceover' ? 'caption' as const :
                                      d.type as 'dialogue' | 'caption' | 'thought' | 'sfx' | 'screen-text' | 'phone',
                                text: d.text,
                                character: d.character,
                                modifier: d.parenthetical
                            })),
                            artistNotes: panel.artistNotes ? [panel.artistNotes] : [],
                            visualMarker: (panel.visualMarker || 'standard') as VisualMarker,
                            aspectRatio: 'wide' as any // Stage plays use wide aspect for blocking
                        })),
                        pageNotes: page.actNumber ? `Act ${page.actNumber}` : undefined
                    })),
                    characters: stageResult.characters.map(c => ({
                        name: c.name,
                        lineCount: c.panelCount,
                        description: c.description
                    })),
                    errors: stageResult.errors.map(e => e.message),
                    warnings: []
                };
                break;
                
            case 'tv-series':
                const tvResult = parseTVScript(script);
                parsed = {
                    success: tvResult.errors.length === 0 || tvResult.pages.length > 0,
                    pages: tvResult.pages.map(page => ({
                        pageNumber: page.pageNumber,
                        panels: page.panels.map(panel => ({
                            panelNumber: panel.panelNumber,
                            description: panel.description,
                            bubbles: panel.dialogue.map(d => ({
                                type: d.type === 'spoken' ? 'dialogue' as const : 
                                      d.type === 'voiceover' ? 'caption' as const :
                                      d.type as 'dialogue' | 'caption' | 'thought' | 'sfx' | 'screen-text' | 'phone',
                                text: d.text,
                                character: d.character,
                                modifier: d.parenthetical
                            })),
                            artistNotes: panel.artistNotes ? [panel.artistNotes] : [],
                            visualMarker: (panel.visualMarker || 'standard') as VisualMarker,
                            aspectRatio: 'wide' as any // TV defaults to 16:9/wide
                        })),
                        pageNotes: page.location ? `${page.sceneType || ''} ${page.location} - ${page.timeOfDay || ''}`.trim() : undefined
                    })),
                    characters: tvResult.characters.map(c => ({
                        name: c.name,
                        lineCount: c.panelCount,
                        description: c.description
                    })),
                    errors: tvResult.errors.map(e => e.message),
                    warnings: []
                };
                break;
                
            case 'comic':
            default:
                // Use the existing comic parser
                parsed = parseScript(script);
                break;
        }
        
        await new Promise(r => setTimeout(r, 200));
        setParseStage('extracting-characters');
        await new Promise(r => setTimeout(r, 300));
        setParseStage('building-pages');
        await new Promise(r => setTimeout(r, 200));
        setParseStage('done');

        setResult(parsed);
        setEditableCharacters(parsed.characters);
        setIsParsing(false);
    };

    const handleImport = () => {
        if (result?.success) {
            const filteredResult = {
                ...result,
                characters: editableCharacters
            };
            onImport(filteredResult, script);
            onClose();
        }
    };

    const handleRemoveCharacter = (characterName: string) => {
        setEditableCharacters(prev => prev.filter(char => char.name !== characterName));
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setScript(ev.target?.result as string || '');
                setResult(null);
                setEditableCharacters([]);
            };
            reader.readAsText(file);
        }
    };

    const getPageLabel = () => {
        const type = project.projectType;
        if (type === 'screenplay' || type === 'tv-series') return 'Scenes';
        if (type === 'stage-play') return 'Scenes';
        return 'Pages';
    };

    const getPanelLabel = () => {
        const type = project.projectType;
        if (type === 'screenplay' || type === 'tv-series') return 'Shots';
        if (type === 'stage-play') return 'Beats';
        return 'Panels';
    };

    const getFormatHint = () => {
        const type = project.projectType;
        switch (type) {
            case 'screenplay':
                return 'Format: INT. LOCATION - TIME / Action description / CHARACTER NAME / Dialogue / CLOSE UP, WIDE SHOT, etc.';
            case 'stage-play':
                return 'Format: ACT ONE / SCENE 1 / (Stage directions) / CHARACTER: Dialogue / (enters), (exits)';
            case 'tv-series':
                return 'Format: EPISODE 101 / TEASER / INT. LOCATION - TIME / (follows screenplay format)';
            case 'comic':
            default:
                return 'Format: PAGE 1 / Panel 1 / CAPTION: / CHARACTER: dialogue / SFX:';
        }
    };

    const totalPanels = result?.pages.reduce((sum, p) => sum + p.panels.length, 0) || 0;
    const markerCounts = result?.pages.reduce((acc, p) => {
        p.panels.forEach(pan => {
            if (pan.visualMarker !== 'standard') {
                acc[pan.visualMarker] = (acc[pan.visualMarker] || 0) + 1;
            }
        });
        return acc;
    }, {} as Record<string, number>) || {};

    return (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-[600] p-8">
            <div className="w-full max-w-5xl bg-paper border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                    <div>
                        <h2 className="font-display text-3xl tracking-widest text-ink uppercase">Script Import</h2>
                        <p className="text-[10px] font-body text-stone-600 mt-1 uppercase tracking-widest">Paste script or upload .txt file</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-stone-100 text-stone-600 hover:text-red-600 border border-stone-200 transition-all text-xl font-bold">×</button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 flex flex-col p-6 border-r border-stone-200">
                        <div className="mb-4">
                            <input
                                type="file"
                                accept=".txt,.md"
                                onChange={handleFile}
                                className="text-[10px] text-stone-600 file:mr-3 file:py-2 file:px-4 file:border file:border-stone-200 file:bg-white file:text-ink file:font-bold file:text-[9px] file:uppercase file:cursor-pointer file:rounded-lg hover:file:bg-stone-50"
                            />
                        </div>
                        <textarea
                            value={script}
                            onChange={(e) => { setScript(e.target.value); setResult(null); setEditableCharacters([]); }}
                            placeholder="Paste your script here..."
                            className="flex-1 w-full bg-white border border-stone-200 rounded-xl p-4 font-body text-xs text-ink outline-none resize-none focus:border-stone-400 transition-colors"
                        />
                        <p className="text-[9px] font-body text-stone-500 mt-2 italic">{getFormatHint()}</p>
                    </div>

                    <div className="w-96 flex flex-col p-6 bg-stone-50">
                        <button
                            onClick={handleParse}
                            disabled={!script.trim() || isParsing}
                            className="w-full py-3 mb-6 bg-ink hover:bg-stone-800 text-white font-bold text-xs uppercase tracking-widest rounded-lg disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                        >
                            {isParsing ? (
                                <>
                                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Parsing...
                                </>
                            ) : (
                                'Parse Script'
                            )}
                        </button>

                        {isParsing && (
                            <ScriptParsingProgress stage={parseStage} projectType={project.projectType} />
                        )}

                        {result && !isParsing && (
                            <div className="flex-1 overflow-y-auto space-y-4">
                                <div className={`p-4 border rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}> 
                                    <p className={`font-bold text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}> 
                                        {result.success ? '✓ Parse Successful' : '✗ Parse Failed'}
                                    </p>
                                    {result.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-600 mt-1">{err}</p>
                                    ))} 
                                </div>

                                {result.success && (
                                    <> 
                                        <div className="grid grid-cols-3 gap-3">  
                                            <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">  
                                                <p className="text-2xl font-display text-ink">{result.pages.length}</p>
                                                <p className="text-[9px] font-body text-stone-600 uppercase">{getPageLabel()}</p>
                                            </div>
                                            <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">  
                                                <p className="text-2xl font-display text-ink">{totalPanels}</p>
                                                <p className="text-[9px] font-body text-stone-600 uppercase">{getPanelLabel()}</p>
                                            </div>
                                            <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">  
                                                <p className="text-2xl font-display text-ink">{editableCharacters.length}</p>
                                                <p className="text-[9px] font-body text-stone-600 uppercase">Characters</p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleImport}
                                            className="w-full py-4 bg-ink hover:bg-stone-800 text-white font-bold text-sm uppercase tracking-widest rounded-lg transition-all mt-4"
                                        >
                                            Import {result.pages.length} {getPageLabel()} → Storyboard
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}