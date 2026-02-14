import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

import {
  Page,
  Issue,
  AspectRatio,
  InkProject,
} from '../types';
import { InkAction } from '../store/inkSlice';
import { useLitStore } from '../store';
import { genId } from '../utils/helpers';
import { getImage, saveImage } from '../services/imageStorage';
import { ART_STYLES, ASPECT_CONFIGS, GENERATION_DELAY_MS } from '../constants';
import { ParseResult } from '../services/scriptParser';
import { ParsedScript } from '../utils/scriptParser';
import { useAuth } from '../context/AuthContext';
import { useCloudSync } from './useCloudSync';
import { useImageGeneration } from './useImageGeneration';
import { seedCharactersFromScript, autoLinkPanelsToCharacters, detectLoreMentions } from '../store/crossSlice';

/**
 * Convert ParsedScript (from LLM parser) to ParseResult (expected by handleScriptImport)
 * 
 * NOTE: This is a bridge function between two data formats:
 * - ParsedScript: Output from parseScriptWithLLM() in utils/scriptParser.ts
 * - ParseResult: Legacy format expected by Ink Tracker storyboard generation
 * 
 * If this conversion is needed elsewhere, consider extracting to a shared utility module.
 */
function convertParsedScriptToParseResult(parsedScript: ParsedScript): ParseResult {
  return {
    success: true,
    pages: parsedScript.pages.map(page => ({
      pageNumber: page.page_number,
      panels: page.panels.map(panel => ({
        panelNumber: panel.panel_number,
        description: panel.description,
        bubbles: panel.dialogue.map(d => ({
          type: d.type === 'spoken' ? 'dialogue' as const :
                d.type === 'thought' ? 'thought' as const :
                d.type === 'caption' ? 'caption' as const :
                d.type === 'sfx' ? 'sfx' as const :
                'dialogue' as const,
          text: d.text,
          character: d.character,
        })),
        artistNotes: [],
        visualMarker: 'standard' as const,
        aspectRatio: 'wide' as any,
      })),
    })),
    characters: parsedScript.characters.map(char => ({
      name: char.name,
      description: char.description,
      lineCount: char.panel_count,
    })),
    errors: [],
    warnings: [],
  };
}

import { generateImage as generateGeminiImage } from '../services/geminiService';
import { generateLeonardoImage } from '../services/leonardoService';
import { generateGrokImage } from '../services/grokService';
import { generateFluxImage as generateFalFlux } from '../services/falFluxService';
import { generateSeaArtImage } from '../services/seaartService';
import { generateOpenAIImage } from '../services/openaiService';

/**
 * Helper to build a full appearance description for image generation
 */
export function buildCharacterPrompt(char: any): string {
  const parts: string[] = [char.name];
  
  if (char.appearance) {
    const a = char.appearance;
    const desc: string[] = [];
    
    if (a.age) desc.push(a.age);
    if (a.gender) desc.push(a.gender);
    if (a.ethnicity) desc.push(a.ethnicity);
    if (a.height) desc.push(a.height);
    if (a.build) desc.push(a.build);
    if (a.skinTone) desc.push(`${a.skinTone} skin`);
    if (a.hairColor && a.hairStyle) {
      desc.push(`${a.hairColor} ${a.hairStyle} hair`);
    } else if (a.hairColor) {
      desc.push(`${a.hairColor} hair`);
    } else if (a.hairStyle) {
      desc.push(`${a.hairStyle} hair`);
    }
    if (a.eyeColor) desc.push(`${a.eyeColor} eyes`);
    if (a.facialFeatures) desc.push(a.facialFeatures);
    if (a.distinguishingMarks) desc.push(a.distinguishingMarks);
    if (a.clothing) desc.push(`wearing ${a.clothing}`);
    if (a.accessories) desc.push(`with ${a.accessories}`);
    if (a.additionalNotes) desc.push(a.additionalNotes);
    
    if (desc.length > 0) {
      parts.push(`(${desc.join(', ')})`);
    }
  } else if (char.description) {
    parts.push(`(${char.description})`);
  }
  
  return parts.join(' ');
}

export function useInkLogic() {
  // ── Zustand store ───────────────────────
  const { inkState, inkDispatch, inkCanUndo, inkCanRedo, characters } = useLitStore();
  const state = inkState;
  const dispatch = inkDispatch;

  const { user, signOut, loading } = useAuth();

  const activeProjectIdRef = useRef<string | null>(state.activeProjectId);

  useEffect(() => {
    activeProjectIdRef.current = state.activeProjectId;
  }, [state.activeProjectId]);

  const handleCloudProjectsLoaded = useCallback((cloudProjects: any[]) => {
    if (!cloudProjects.length) return;
    const preferredProjectId = activeProjectIdRef.current &&
      cloudProjects.some((project: any) => project.id === activeProjectIdRef.current)
      ? activeProjectIdRef.current
      : cloudProjects[0]?.id;
    const activeProject = cloudProjects.find((project: any) => project.id === preferredProjectId);

    dispatch({
      type: 'HYDRATE',
      payload: {
        projects: cloudProjects,
        activeProjectId: preferredProjectId || null,
        activeIssueId: activeProject?.issues[0]?.id || null,
        activePageId: activeProject?.issues[0]?.pages[0]?.id || null,
      },
    });
  }, [dispatch]);

  const { syncStatus } = useCloudSync(state, handleCloudProjectsLoaded);
  
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [batching, setBatching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showScriptImport, setShowScriptImport] = useState(false);
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [showGutters, setShowGutters] = useState(false);
  const [showSpreadView, setShowSpreadView] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showScriptPanel, setShowScriptPanel] = useState(false);
  const [showReadThrough, setShowReadThrough] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [copiedPanelSettings, setCopiedPanelSettings] = useState<{ aspectRatio: AspectRatio; characterIds: string[] } | null>(null);
  const [showCharacterBank, setShowCharacterBank] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'guide'>('canvas');
  const [showSplitView, setShowSplitView] = useState(false);
  
  // Generate All state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(0);
  const [totalPanels, setTotalPanels] = useState(0);
  const cancelGenerationRef = useRef(false);

  const activeProject = state.projects.find(p => p.id === state.activeProjectId);
  const activeIssue = activeProject?.issues.find(i => i.id === state.activeIssueId);
  const activePage = activeIssue?.pages.find(p => p.id === state.activePageId);
  
  // Use the shared image generation hook
  const imageGeneration = activeProject ? useImageGeneration(activeProject) : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // When PresentMode is open, it handles its own keyboard via capture phase.
      // Don't let App-level handlers interfere.
      if (showReadThrough) return;

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (inkCanUndo) {
          dispatch({ type: 'UNDO' });
        }
      }
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (inkCanRedo) {
          dispatch({ type: 'REDO' });
        }
      }
      
      // Panel navigation with arrow keys
      if (activePage && activePage.panels.length > 0) {
        const currentIndex = selectedPanelId 
          ? activePage.panels.findIndex(p => p.id === selectedPanelId)
          : -1;
        
        // Left/Up arrow: previous panel
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = currentIndex <= 0 ? activePage.panels.length - 1 : currentIndex - 1;
          setSelectedPanelId(activePage.panels[newIndex].id);
        }
        // Right/Down arrow: next panel
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = currentIndex >= activePage.panels.length - 1 ? 0 : currentIndex + 1;
          setSelectedPanelId(activePage.panels[newIndex].id);
        }
        // Delete: remove selected panel
        if (e.key === 'Delete' && selectedPanelId) {
          e.preventDefault();
          if (confirm('Delete this panel?')) {
            dispatch({ type: 'DELETE_PANEL', panelId: selectedPanelId, pageId: activePage.id });
            setSelectedPanelId(null);
          }
        }
        // Escape: deselect
        if (e.key === 'Escape') {
          setSelectedPanelId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inkCanUndo, inkCanRedo, activePage, selectedPanelId, showReadThrough, dispatch]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Track drag delta for freeform positioning
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const panelId = event.active.id as string;
    setActiveId(panelId);
    const panel = activePage?.panels.find(p => p.id === panelId);
    if (panel) {
      dragStartPos.current = { x: panel.x || 0, y: panel.y || 0 };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);
    
    if (active && dragStartPos.current && activePage) {
      const panelId = active.id as string;
      // Calculate new position based on drag delta
      const newX = Math.max(0, dragStartPos.current.x + delta.x);
      const newY = Math.max(0, dragStartPos.current.y + delta.y);
      
      dispatch({ 
        type: 'UPDATE_PANEL', 
        panelId, 
        updates: { x: newX, y: newY } 
      });
    }
    dragStartPos.current = null;
  };

  const activePanelForOverlay = useMemo(() => {
    return activePage?.panels.find(p => p.id === activeId);
  }, [activeId, activePage]);

  const handleExportPage = async () => {
    if (!activePage) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const zip = new JSZip();
      const pageFolder = zip.folder(`Page_${activePage.number}`);
      for (let i = 0; i < activePage.panels.length; i++) {
        const panel = activePage.panels[i];
        if (panel.imageUrl) {
          let dataUrl = panel.imageUrl;
          if (dataUrl.startsWith('idb://')) {
            const id = dataUrl.replace('idb://', '');
            dataUrl = await getImage(id) || '';
          }
          if (dataUrl) {
            const base64 = dataUrl.split(',')[1];
            pageFolder?.file(`panel_${i + 1}.png`, base64, { base64: true });
          }
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Page_${activePage.number}_Ink.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e);
    } finally {
      setExporting(false);
    }
  };

  const handleExportIssue = async () => {
    if (!activeIssue) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const zip = new JSZip();
      for (const page of activeIssue.pages) {
        for (let i = 0; i < page.panels.length; i++) {
          const panel = page.panels[i];
          if (panel.imageUrl) {
            let dataUrl = panel.imageUrl;
            if (dataUrl.startsWith('idb://')) {
              const id = dataUrl.replace('idb://', '');
              dataUrl = await getImage(id) || '';
            }
            if (dataUrl) {
              const base64 = dataUrl.split(',')[1];
              const fileName = `pg${String(page.number).padStart(3, '0')}_p${String(i + 1).padStart(2, '0')}.png`;
              zip.file(fileName, base64, { base64: true });
            }
          }
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeIssue.title.replace(/\s+/g, '_')}.cbz`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export failed: " + e);
    } finally {
      setExporting(false);
    }
  };

  // Export page as PDF
  const handleExportPagePDF = async () => {
    if (!activePage) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      // Create PDF in landscape for comic pages
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let hasContent = false;
      for (let i = 0; i < activePage.panels.length; i++) {
        const panel = activePage.panels[i];
        if (panel.imageUrl) {
          let dataUrl = panel.imageUrl;
          if (dataUrl.startsWith('idb://')) {
            const id = dataUrl.replace('idb://', '');
            dataUrl = await getImage(id) || '';
          }
          if (dataUrl) {
            if (hasContent) pdf.addPage();
            hasContent = true;
            
            // Add image centered on page
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.src = dataUrl;
            });
            
            const imgRatio = img.width / img.height;
            const pageRatio = pageWidth / pageHeight;
            let imgWidth, imgHeight;
            
            if (imgRatio > pageRatio) {
              imgWidth = pageWidth - 20;
              imgHeight = imgWidth / imgRatio;
            } else {
              imgHeight = pageHeight - 20;
              imgWidth = imgHeight * imgRatio;
            }
            
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;
            
            pdf.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);
            
            // Add panel number
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text(`Panel ${i + 1}`, 10, 10);
          }
        }
      }
      
      if (hasContent) {
        pdf.save(`Page_${activePage.number}.pdf`);
      } else {
        alert('No images to export');
      }
    } catch (e) {
      alert("PDF export failed: " + e);
    } finally {
      setExporting(false);
    }
  };

  // Export issue as PDF
  const handleExportIssuePDF = async () => {
    if (!activeIssue) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let hasContent = false;
      for (const page of activeIssue.pages) {
        for (let i = 0; i < page.panels.length; i++) {
          const panel = page.panels[i];
          if (panel.imageUrl) {
            let dataUrl = panel.imageUrl;
            if (dataUrl.startsWith('idb://')) {
              const id = dataUrl.replace('idb://', '');
              dataUrl = await getImage(id) || '';
            }
            if (dataUrl) {
              if (hasContent) pdf.addPage();
              hasContent = true;
              
              const img = new Image();
              await new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.src = dataUrl;
              });
              
              const imgRatio = img.width / img.height;
              const pageRatio = pageWidth / pageHeight;
              let imgWidth, imgHeight;
              
              if (imgRatio > pageRatio) {
                imgWidth = pageWidth - 20;
                imgHeight = imgWidth / imgRatio;
              } else {
                imgHeight = pageHeight - 20;
                imgWidth = imgHeight * imgRatio;
              }
              
              const x = (pageWidth - imgWidth) / 2;
              const y = (pageHeight - imgHeight) / 2;
              
              pdf.addImage(dataUrl, 'PNG', x, y, imgWidth, imgHeight);
              
              pdf.setFontSize(10);
              pdf.setTextColor(150);
              pdf.text(`Page ${page.number} - Panel ${i + 1}`, 10, 10);
            }
          }
        }
      }
      
      if (hasContent) {
        pdf.save(`${activeIssue.title.replace(/\s+/g, '_')}.pdf`);
      } else {
        alert('No images to export');
      }
    } catch (e) {
      alert("PDF export failed: " + e);
    } finally {
      setExporting(false);
    }
  };

  const handleScriptImport = (result: ParseResult, scriptText: string) => {
    if (!result.success || !activeProject) return;

    // 1. Seed characters into the global Character module
    const seedResult = seedCharactersFromScript(result.characters, characters as any);

    // Add newly created characters to the store
    for (const newChar of seedResult.created) {
      useLitStore.getState().addCharacter({
        name: newChar.name,
        role: newChar.role,
        archetype: newChar.archetype,
        eras: newChar.eras,
        voice_profile: newChar.voice_profile,
        smart_tags: newChar.smart_tags,
        gallery: newChar.gallery,
        loreEntryIds: newChar.loreEntryIds,
        description: newChar.description,
      });
    }

    // Get the updated character list (includes freshly added ones)
    const allChars = useLitStore.getState().characters;

    // Rebuild nameToId with actual IDs from store (addCharacter generates new IDs)
    const nameToId = new Map<string, string>();
    for (const parsed of result.characters) {
      const match = allChars.find(c => c.name.toLowerCase().trim() === parsed.name.toLowerCase().trim());
      if (match) nameToId.set(parsed.name.toLowerCase().trim(), match.id);
    }

    // 2. Build pages with auto-linked character IDs
    const newPages: Page[] = result.pages.map((parsedPage) => ({
      id: genId(),
      number: parsedPage.pageNumber,
      panels: parsedPage.panels.map((parsedPanel, index) => {
        // Auto-detect which characters appear in this panel
        const panelText = [
          parsedPanel.description,
          ...parsedPanel.bubbles.map(b => `${b.character || ''} ${b.text}`),
        ].join(' ');

        const detectedCharIds: string[] = [];
        for (const [name, charId] of nameToId.entries()) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`\\b${escaped}\\b`, 'i').test(panelText)) {
            detectedCharIds.push(charId);
          }
        }

        return {
          id: genId(),
          prompt: parsedPanel.description,
          aspectRatio: parsedPanel.aspectRatio,
          characterIds: [...new Set(detectedCharIds)],
          x: (index % 3) * 400,
          y: Math.floor(index / 3) * 500,
          textElements: parsedPanel.bubbles.map((bubble, idx) => ({
            id: genId(),
            type: bubble.type === 'dialogue' ? 'dialogue' as const : bubble.type === 'thought' ? 'thought' as const : 'caption' as const,
            content: bubble.character ? `${bubble.character}: ${bubble.text}` : bubble.text,
            x: 10, y: 10 + (idx * 15), width: 30, height: 10, fontSize: 18, color: '#000000', rotation: 0, tailX: 15, tailY: 10 + (idx * 15) + 15,
            tailStyle: bubble.type === 'thought' ? 'cloud' : (bubble.type === 'caption' ? 'none' : 'pointy')
          })),
          scriptRef: parsedPanel.startOffset !== undefined && parsedPanel.endOffset !== undefined ? {
            pageNumber: parsedPage.pageNumber,
            panelNumber: parsedPanel.panelNumber,
            startOffset: parsedPanel.startOffset,
            endOffset: parsedPanel.endOffset,
            visualMarker: parsedPanel.visualMarker
          } : undefined
        };
      }),
    }));

    // 3. Also detect lore mentions for awareness
    const loreEntries = useLitStore.getState().loreEntries;
    const newIssueForDetection: Issue = { id: 'temp', title: '', pages: newPages };
    const loreMentions = detectLoreMentions(newIssueForDetection, loreEntries);

    const newCharacters: any[] = result.characters.map(c => ({
      id: genId(),
      name: c.name,
      description: c.firstAppearance || `${c.lineCount} lines`,
    }));
    const newIssue: Issue = { 
      id: genId(), 
      title: result.issue?.title ? `${result.issue.title}${result.issue.issueNumber ? ` #${result.issue.issueNumber}` : ''}` : `Imported: ${result.pages.length} Pages`, 
      pages: newPages,
      scriptText: scriptText
    };
    dispatch({ type: 'IMPORT_ISSUE', projectId: activeProject.id, issue: newIssue, characters: newCharacters });
    setShowScriptImport(false);
    setShowScriptPanel(true);

    // 4. Log sync summary (will be a toast/notification later)
    const summary = [
      seedResult.created.length > 0 ? `${seedResult.created.length} new character${seedResult.created.length > 1 ? 's' : ''} added` : null,
      seedResult.existing.length > 0 ? `${seedResult.existing.length} existing matched` : null,
      loreMentions.length > 0 ? `${loreMentions.length} lore mention${loreMentions.length > 1 ? 's' : ''} detected` : null,
    ].filter(Boolean).join(' · ');
    if (summary) console.log(`[LIT Sync] ${summary}`);
  };

  // Import script from store (parsed via Lore Tracker)
  const handleImportFromStore = () => {
    const parsedScriptResult = useLitStore.getState().parsedScriptResult;
    const rawScriptText = useLitStore.getState().rawScriptText;
    
    if (!parsedScriptResult) {
      alert('No parsed script found. Please go to the Lore Tracker and parse a script first using "Extract from Script".');
      return;
    }
    
    if (!activeProject) {
      alert('No active project. Please create or select a project first.');
      return;
    }
    
    // Convert ParsedScript to ParseResult format
    const parseResult = convertParsedScriptToParseResult(parsedScriptResult);
    
    // Use existing handleScriptImport logic
    handleScriptImport(parseResult, rawScriptText || '');
  };

  // Auto-link: scan current issue's panels and link characters by name match
  const handleAutoLink = () => {
    if (!activeIssue || !activeProject) return;
    const allChars = useLitStore.getState().characters;
    const result = autoLinkPanelsToCharacters(activeIssue, allChars as any);
    if (result.newLinkCount === 0) {
      alert('All panels are already linked. No new character matches found.');
      return;
    }
    if (!confirm(`Found ${result.newLinkCount} new character link${result.newLinkCount > 1 ? 's' : ''} across ${result.panelLinks.size} panel${result.panelLinks.size > 1 ? 's' : ''}. Apply?`)) return;

    // Apply links via dispatch
    for (const [panelId, charIds] of result.panelLinks) {
      const panel = activeIssue.pages.flatMap(p => p.panels).find(p => p.id === panelId);
      if (panel) {
        dispatch({
          type: 'UPDATE_PANEL',
          panelId,
          updates: { characterIds: [...new Set([...panel.characterIds, ...charIds])] },
        });
      }
    }
  };

  const generatePage = async () => {
    if (!activePage || batching || !activeProject) return;
    setBatching(true);
    try {
      for (const panel of activePage.panels) {
        if (!panel.prompt && panel.characterIds.length === 0) continue;
        if (panel.imageUrl) continue;
        const styleConfig = ART_STYLES.find(s => s.id === activeProject?.style);
        const stylePrompt = styleConfig?.prompt || '';
        const activeChars = characters.filter((c: any) => panel.characterIds.includes(c.id));
        // Use buildCharacterPrompt for full appearance descriptions
        const charSection = activeChars.length > 0 ? `Characters: ${activeChars.map(c => buildCharacterPrompt(c)).join('; ')}.` : '';
        const config = ASPECT_CONFIGS[panel.aspectRatio];
        let initImage: string | undefined;
        if (panel.referencePanelId) {
          const refPanel = activePage.panels.find(p => p.id === panel.referencePanelId);
          if (refPanel?.imageUrl) {
            const id = refPanel.imageUrl.startsWith('idb://') ? refPanel.imageUrl.slice(6) : null;
            if (id) initImage = await getImage(id) || undefined;
          }
        }
        const consistencySuffix = " Maintain strong visual and character consistency with the reference image. Same lighting, angle, style.";
        const fullPrompt = `${stylePrompt}. ${charSection} ${panel.prompt}.${initImage ? consistencySuffix : ''}`.trim();
        let url: string | undefined;
        try {
          if (activeProject.imageProvider === 'gemini' && activeProject.geminiApiKey) {
            url = await generateGeminiImage(fullPrompt, config.ratio, activeProject.geminiApiKey, initImage, panel.referenceStrength ?? 0.7);
          } else if (activeProject.imageProvider === 'leonardo' && activeProject.leonardoApiKey) {
            url = await generateLeonardoImage(fullPrompt, panel.aspectRatio, activeProject.leonardoApiKey, initImage, panel.referenceStrength ?? 0.7);
          } else if (activeProject.imageProvider === 'grok' && activeProject.grokApiKey) {
            url = await generateGrokImage(fullPrompt, panel.aspectRatio, activeProject.grokApiKey, initImage, panel.referenceStrength ?? 0.7);
          } else if (activeProject.imageProvider === 'fal' && activeProject.falApiKey) {
            url = await generateFalFlux(fullPrompt, panel.aspectRatio, activeProject.falApiKey, activeProject.fluxModel || 'fal-ai/flux-pro', initImage, panel.referenceStrength ?? 0.7);
          } else if (activeProject.imageProvider === 'seaart' && activeProject.seaartApiKey) {
            url = await generateSeaArtImage(fullPrompt, panel.aspectRatio, activeProject.seaartApiKey, initImage, panel.referenceStrength ?? 0.7);
          } else if (activeProject.imageProvider === 'openai' && activeProject.openaiApiKey) {
            url = await generateOpenAIImage(fullPrompt, panel.aspectRatio, activeProject.openaiApiKey, initImage, panel.referenceStrength ?? 0.7);
          } else {
            console.warn(`No API key configured for provider: ${activeProject.imageProvider}`);
          }
        } catch (err) { console.error(err); }
        if (url) {
          const storedRef = await saveImage(panel.id, url);
          dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { imageUrl: storedRef } });
        }
        await new Promise(r => setTimeout(r, GENERATION_DELAY_MS));
      }
    } catch (e: any) {
      alert(`Batch Failed: ${e.message}`);
    } finally { setBatching(false); }
  };

  const handleGenerateAll = async () => {
    if (!activePage || !activeProject || !imageGeneration) return;
    
    // Get panels that need generation (have prompt, no image)
    const panelsToGenerate = activePage.panels.filter(
      panel => (panel.prompt?.trim() || panel.characterIds.length > 0) && !panel.imageUrl
    );
    
    if (panelsToGenerate.length === 0) {
      alert('No panels to generate. All panels either have images or lack prompts.');
      return;
    }
    
    setIsGeneratingAll(true);
    setTotalPanels(panelsToGenerate.length);
    cancelGenerationRef.current = false;
    
    for (let i = 0; i < panelsToGenerate.length; i++) {
      if (cancelGenerationRef.current) {
        console.log('Generation cancelled by user');
        break;
      }
      
      setCurrentPanel(i + 1);
      const panel = panelsToGenerate[i];
      
      try {
        // Get active characters for this panel
        const activeChars = characters.filter((c: any) => panel.characterIds.includes(c.id));
        
        // Get reference image if set
        let initImage: string | undefined;
        if (panel.referencePanelId) {
          const refPanel = activePage.panels.find(p => p.id === panel.referencePanelId);
          if (refPanel?.imageUrl) {
            const id = refPanel.imageUrl.startsWith('idb://') ? refPanel.imageUrl.slice(6) : null;
            if (id) initImage = await getImage(id) || undefined;
          }
        }
        
        // Use the shared hook to generate
        const url = await imageGeneration.generateImage(
          panel.prompt || '',
          panel.aspectRatio,
          activeChars,
          initImage,
          panel.referenceStrength ?? 0.7
        );
        
        if (url) {
          const storedRef = await saveImage(panel.id, url);
          dispatch({ type: 'UPDATE_PANEL', panelId: panel.id, updates: { imageUrl: storedRef } });
        }
        
        // Delay between generations (same as AUTO-INK)
        await new Promise(r => setTimeout(r, GENERATION_DELAY_MS));
        
      } catch (err) {
        console.error(`Failed to generate panel ${i + 1}:`, err);
        // Continue to next panel instead of stopping
      }
    }
    
    setIsGeneratingAll(false);
    setCurrentPanel(0);
    setTotalPanels(0);
  };

  // Page navigation handlers for spread view
  const handlePreviousPage = () => {
    if (!activeIssue || !activePage) return;
    const currentIndex = activeIssue.pages.findIndex((p: Page) => p.id === activePage.id);
    const step = showSpreadView ? 2 : 1;
    const newIndex = Math.max(0, currentIndex - step);
    if (newIndex !== currentIndex) {
      dispatch({ type: 'SET_ACTIVE_PAGE', id: activeIssue.pages[newIndex].id });
    }
  };

  const handleNextPage = () => {
    if (!activeIssue || !activePage) return;
    const currentIndex = activeIssue.pages.findIndex((p: Page) => p.id === activePage.id);
    const step = showSpreadView ? 2 : 1;
    const newIndex = Math.min(activeIssue.pages.length - 1, currentIndex + step);
    if (newIndex !== currentIndex) {
      dispatch({ type: 'SET_ACTIVE_PAGE', id: activeIssue.pages[newIndex].id });
    }
  };

  return {
    // State
    state,
    dispatch,
    inkCanUndo,
    inkCanRedo,
    characters,
    user,
    signOut,
    loading,
    syncStatus,
    
    // UI State
    projectsOpen,
    setProjectsOpen,
    batching,
    exporting,
    showExportMenu,
    setShowExportMenu,
    activeId,
    showScriptImport,
    setShowScriptImport,
    zoomEnabled,
    setZoomEnabled,
    showGutters,
    setShowGutters,
    showSpreadView,
    setShowSpreadView,
    showTemplateMenu,
    setShowTemplateMenu,
    showScriptPanel,
    setShowScriptPanel,
    showReadThrough,
    setShowReadThrough,
    selectedPanelId,
    setSelectedPanelId,
    copiedPanelSettings,
    setCopiedPanelSettings,
    showCharacterBank,
    setShowCharacterBank,
    activeTab,
    setActiveTab,
    showSplitView,
    setShowSplitView,
    
    // Generate All State
    isGeneratingAll,
    currentPanel,
    totalPanels,
    cancelGenerationRef,
    
    // Computed Values
    activeProject,
    activeIssue,
    activePage,
    activePanelForOverlay,
    
    // Handlers
    handleScriptImport,
    handleImportFromStore,
    generatePage,
    handleGenerateAll,
    handleAutoLink,
    handleExportPage,
    handleExportIssue,
    handleExportPagePDF,
    handleExportIssuePDF,
    handleDragStart,
    handleDragEnd,
    handlePreviousPage,
    handleNextPage,
    
    // DnD
    sensors,
  };
}
