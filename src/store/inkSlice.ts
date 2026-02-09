import { StateCreator } from 'zustand';
import {
  InkAppState,
  AppStateWithHistory as InkStateWithHistory,
  InkProject,
  Issue,
  Page,
  Panel,
  TextElement,
  AspectRatio,
  Character as InkCharacter,
} from '../types';

// =============================================================================
// ACTION TYPES — preserved exactly from Ink Tracker's state/actions.ts
// =============================================================================

export type PageTemplate = '2x2' | '3x3' | '2x3' | 'manga-right' | 'manga-left' | 'single' | 'double-wide';

export type InkAction =
  | { type: 'HYDRATE'; payload: InkAppState }
  | { type: 'SET_ACTIVE_PROJECT'; id: string }
  | { type: 'ADD_PROJECT'; title: string; projectType?: 'comic' | 'screenplay' | 'stage-play' | 'tv-series' }
  | { type: 'UPDATE_PROJECT'; id: string; updates: Partial<InkProject> }
  | { type: 'UPDATE_PROJECT_GEMINI_KEY'; projectId: string; apiKey: string }
  | { type: 'UPDATE_PROJECT_LEONARDO_KEY'; projectId: string; apiKey: string }
  | { type: 'UPDATE_PROJECT_GROK_KEY'; projectId: string; apiKey: string }
  | { type: 'UPDATE_PROJECT_FAL_KEY'; projectId: string; apiKey: string }
  | { type: 'UPDATE_PROJECT_SEAART_KEY'; projectId: string; apiKey: string }
  | { type: 'UPDATE_PROJECT_OPENAI_KEY'; projectId: string; apiKey: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'ADD_ISSUE'; projectId: string; title?: string }
  | { type: 'UPDATE_ISSUE'; issueId: string; updates: Partial<Issue> }
  | { type: 'DELETE_ISSUE'; issueId: string }
  | { type: 'SET_ACTIVE_ISSUE'; id: string }
  | { type: 'ADD_PAGE'; issueId: string }
  | { type: 'SET_ACTIVE_PAGE'; id: string }
  | { type: 'ADD_PANEL'; pageId: string }
  | { type: 'UPDATE_PANEL'; panelId: string; updates: Partial<Panel> }
  | { type: 'DELETE_PANEL'; panelId: string; pageId: string }
  | { type: 'REORDER_PANELS'; pageId: string; panels: Panel[] }
  | { type: 'REORDER_PAGES'; issueId: string; oldIndex: number; newIndex: number }
  | { type: 'ADD_CHARACTER'; name: string; description: string; appearance?: InkCharacter['appearance'] }
  | { type: 'UPDATE_CHARACTER'; id: string; updates: Partial<Omit<InkCharacter, 'id'>> }
  | { type: 'DELETE_CHARACTER'; id: string }
  | { type: 'ADD_TEXT_ELEMENT'; panelId: string; element: TextElement }
  | { type: 'UPDATE_TEXT_ELEMENT'; panelId: string; elementId: string; updates: Partial<TextElement> }
  | { type: 'DELETE_TEXT_ELEMENT'; panelId: string; elementId: string }
  | { type: 'IMPORT_ISSUE'; projectId: string; issue: Issue; characters: InkCharacter[] }
  | { type: 'APPLY_PAGE_TEMPLATE'; pageId: string; template: PageTemplate }
  | { type: 'UNDO' }
  | { type: 'REDO' };

// =============================================================================
// INK APP STATE — the "present" state shape from the original Ink Tracker
// This mirrors the original AppState but uses InkProject instead of Project
// so it doesn't collide with the unified Character type.
// =============================================================================

// InkAppState and InkStateWithHistory imported from ../types

// =============================================================================
// HELPERS
// =============================================================================

const genId = () => crypto.randomUUID();

const getDefaultAspectRatio = (projectType?: string): AspectRatio => {
  switch (projectType) {
    case 'screenplay': return AspectRatio.WIDE;
    case 'stage-play': return AspectRatio.STD;
    case 'tv-series': return AspectRatio.WIDE;
    default: return AspectRatio.STD;
  }
};

const MAX_HISTORY = 50;

// Page template configurations
const PAGE_TEMPLATES: Record<PageTemplate, { panels: Array<{ x: number; y: number; width: number; height: number; aspectRatio: AspectRatio }> }> = {
  '2x2': {
    panels: [
      { x: 40, y: 40, width: 360, height: 300, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 40, width: 360, height: 300, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 360, width: 360, height: 300, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 360, width: 360, height: 300, aspectRatio: AspectRatio.WIDE },
    ]
  },
  '3x3': {
    panels: [
      { x: 40, y: 40, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 300, y: 40, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 560, y: 40, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 40, y: 260, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 300, y: 260, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 560, y: 260, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 40, y: 480, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 300, y: 480, width: 240, height: 200, aspectRatio: AspectRatio.STD },
      { x: 560, y: 480, width: 240, height: 200, aspectRatio: AspectRatio.STD },
    ]
  },
  '2x3': {
    panels: [
      { x: 40, y: 40, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 40, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 260, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 260, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 480, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 480, width: 360, height: 200, aspectRatio: AspectRatio.WIDE },
    ]
  },
  'manga-right': {
    panels: [
      { x: 420, y: 40, width: 360, height: 280, aspectRatio: AspectRatio.STD },
      { x: 40, y: 40, width: 360, height: 180, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 240, width: 360, height: 180, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 440, width: 280, height: 220, aspectRatio: AspectRatio.STD },
      { x: 340, y: 340, width: 440, height: 320, aspectRatio: AspectRatio.WIDE },
    ]
  },
  'manga-left': {
    panels: [
      { x: 40, y: 40, width: 360, height: 280, aspectRatio: AspectRatio.STD },
      { x: 420, y: 40, width: 360, height: 180, aspectRatio: AspectRatio.WIDE },
      { x: 420, y: 240, width: 360, height: 180, aspectRatio: AspectRatio.WIDE },
      { x: 500, y: 440, width: 280, height: 220, aspectRatio: AspectRatio.STD },
      { x: 40, y: 340, width: 440, height: 320, aspectRatio: AspectRatio.WIDE },
    ]
  },
  'single': {
    panels: [
      { x: 40, y: 40, width: 720, height: 600, aspectRatio: AspectRatio.WIDE },
    ]
  },
  'double-wide': {
    panels: [
      { x: 40, y: 40, width: 740, height: 300, aspectRatio: AspectRatio.WIDE },
      { x: 40, y: 360, width: 740, height: 300, aspectRatio: AspectRatio.WIDE },
    ]
  },
};

// =============================================================================
// CORE REDUCER — ported directly from state/reducer.ts
// =============================================================================

function inkAppReducer(state: InkAppState, action: InkAction): InkAppState {
  let newState = { ...state };

  switch (action.type) {
    case 'HYDRATE':
      return action.payload;

    case 'SET_ACTIVE_PROJECT': {
      const p = state.projects.find(x => x.id === action.id);
      return {
        ...state,
        activeProjectId: action.id,
        activeIssueId: p?.issues[0]?.id || null,
        activePageId: p?.issues[0]?.pages[0]?.id || null,
      };
    }

    case 'ADD_PROJECT': {
      const newProj: InkProject = {
        id: genId(),
        title: action.title,
        style: 'classic-noir',
        issueType: 'issue',
        imageProvider: 'gemini',
        projectType: action.projectType || 'comic',
        fluxModel: 'fal-ai/flux-pro',
        issues: [{ id: genId(), title: 'Issue #1', pages: [{ id: genId(), number: 1, panels: [] }] }],
      };
      return {
        ...state,
        projects: [...state.projects, newProj],
        activeProjectId: newProj.id,
        activeIssueId: newProj.issues[0].id,
        activePageId: newProj.issues[0].pages[0].id,
      };
    }

    case 'UPDATE_PROJECT':
      newState.projects = state.projects.map(p => p.id === action.id ? { ...p, ...action.updates } : p);
      break;

    case 'UPDATE_PROJECT_GEMINI_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, geminiApiKey: action.apiKey } : p);
      break;

    case 'UPDATE_PROJECT_LEONARDO_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, leonardoApiKey: action.apiKey } : p);
      break;

    case 'UPDATE_PROJECT_GROK_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, grokApiKey: action.apiKey } : p);
      break;

    case 'UPDATE_PROJECT_FAL_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, falApiKey: action.apiKey } : p);
      break;

    case 'UPDATE_PROJECT_SEAART_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, seaartApiKey: action.apiKey } : p);
      break;

    case 'UPDATE_PROJECT_OPENAI_KEY':
      newState.projects = state.projects.map(p => p.id === action.projectId ? { ...p, openaiApiKey: action.apiKey } : p);
      break;

    case 'DELETE_PROJECT': {
      newState.projects = state.projects.filter(p => p.id !== action.id);
      if (state.activeProjectId === action.id) {
        newState.activeProjectId = newState.projects[0]?.id || null;
      }
      break;
    }

    case 'ADD_ISSUE':
      newState.projects = state.projects.map(proj => {
        if (proj.id !== action.projectId) return proj;
        const typeLabel = proj.issueType === 'issue' ? 'Issue' : 'Chapter';
        const num = proj.issues.length + 1;
        const newIss: Issue = {
          id: genId(),
          title: action.title || `${typeLabel} #${num}`,
          pages: [{ id: genId(), number: 1, panels: [] }],
        };
        newState.activeIssueId = newIss.id;
        newState.activePageId = newIss.pages[0].id;
        return { ...proj, issues: [...proj.issues, newIss] };
      });
      break;

    case 'UPDATE_ISSUE':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => iss.id === action.issueId ? { ...iss, ...action.updates } : iss),
      }));
      break;

    case 'DELETE_ISSUE':
      newState.projects = state.projects.map(proj => {
        const remaining = proj.issues.filter(i => i.id !== action.issueId);
        if (state.activeIssueId === action.issueId) {
          newState.activeIssueId = remaining[0]?.id || null;
          newState.activePageId = remaining[0]?.pages[0]?.id || null;
        }
        return { ...proj, issues: remaining };
      });
      break;

    case 'SET_ACTIVE_ISSUE': {
      const activeP = state.projects.find(proj => proj.issues.some(i => i.id === action.id));
      const activeIss = activeP?.issues.find(i => i.id === action.id);
      newState.activeIssueId = action.id;
      newState.activePageId = activeIss?.pages[0]?.id || null;
      break;
    }

    case 'ADD_PAGE':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => {
          if (iss.id !== action.issueId) return iss;
          const newPg: Page = { id: genId(), number: iss.pages.length + 1, panels: [] };
          newState.activePageId = newPg.id;
          return { ...iss, pages: [...iss.pages, newPg] };
        }),
      }));
      break;

    case 'SET_ACTIVE_PAGE':
      newState.activePageId = action.id;
      break;

    case 'ADD_PANEL':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => {
            if (pg.id !== action.pageId) return pg;
            const panelCount = pg.panels.length;
            const col = panelCount % 3;
            const row = Math.floor(panelCount / 3);
            const defaultAR = getDefaultAspectRatio(proj.projectType);
            const newPan: Panel = {
              id: genId(), prompt: '', aspectRatio: defaultAR,
              characterIds: [], textElements: [],
              x: 40 + (col * 400), y: 40 + (row * 480), width: 360, height: 420,
            };
            return { ...pg, panels: [...pg.panels, newPan] };
          }),
        })),
      }));
      break;

    case 'UPDATE_PANEL':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => ({
            ...pg,
            panels: pg.panels.map(pan => {
              if (pan.id !== action.panelId) return pan;
              let updates = { ...action.updates };
              if ('prompt' in updates && updates.prompt !== pan.prompt) {
                const oldPrompt = pan.prompt;
                if (oldPrompt?.trim()) {
                  const history = pan.promptHistory || [];
                  const newHistory = [...history, oldPrompt].slice(-5);
                  updates = { ...updates, promptHistory: newHistory };
                }
              }
              return { ...pan, ...updates };
            }),
          })),
        })),
      }));
      break;

    case 'DELETE_PANEL':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg =>
            pg.id === action.pageId
              ? { ...pg, panels: pg.panels.filter(pan => pan.id !== action.panelId) }
              : pg
          ),
        })),
      }));
      break;

    case 'REORDER_PANELS':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => pg.id === action.pageId ? { ...pg, panels: action.panels } : pg),
        })),
      }));
      break;

    case 'REORDER_PAGES':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => {
          if (iss.id !== action.issueId) return iss;
          const pages = [...iss.pages];
          const [moved] = pages.splice(action.oldIndex, 1);
          pages.splice(action.newIndex, 0, moved);
          return { ...iss, pages: pages.map((p, i) => ({ ...p, number: i + 1 })) };
        }),
      }));
      break;

    case 'ADD_CHARACTER':
      newState.projects = state.projects.map(proj => {
        if (proj.id !== state.activeProjectId) return proj;
        // Note: This handles Ink Tracker's legacy character model within InkProject.
        // Full character management lives in the characterSlice.
        return proj;
      });
      break;

    case 'UPDATE_CHARACTER':
      // Handled by characterSlice in the unified store
      break;

    case 'DELETE_CHARACTER':
      // Remove characterId references from panels
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => ({
            ...pg,
            panels: pg.panels.map(pan => ({
              ...pan,
              characterIds: pan.characterIds.filter(id => id !== action.id),
            })),
          })),
        })),
      }));
      break;

    case 'ADD_TEXT_ELEMENT':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => ({
            ...pg,
            panels: pg.panels.map(pan =>
              pan.id === action.panelId
                ? { ...pan, textElements: [...pan.textElements, action.element] }
                : pan
            ),
          })),
        })),
      }));
      break;

    case 'UPDATE_TEXT_ELEMENT':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => ({
            ...pg,
            panels: pg.panels.map(pan =>
              pan.id === action.panelId
                ? { ...pan, textElements: pan.textElements.map(te => te.id === action.elementId ? { ...te, ...action.updates } : te) }
                : pan
            ),
          })),
        })),
      }));
      break;

    case 'DELETE_TEXT_ELEMENT':
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => ({
            ...pg,
            panels: pg.panels.map(pan =>
              pan.id === action.panelId
                ? { ...pan, textElements: pan.textElements.filter(te => te.id !== action.elementId) }
                : pan
            ),
          })),
        })),
      }));
      break;

    case 'IMPORT_ISSUE':
      newState.projects = state.projects.map(proj => {
        if (proj.id !== action.projectId) return proj;
        return { ...proj, issues: [...proj.issues, action.issue] };
      });
      newState.activeIssueId = action.issue.id;
      newState.activePageId = action.issue.pages[0]?.id || null;
      break;

    case 'APPLY_PAGE_TEMPLATE': {
      const template = PAGE_TEMPLATES[action.template];
      if (!template) break;
      newState.projects = state.projects.map(proj => ({
        ...proj,
        issues: proj.issues.map(iss => ({
          ...iss,
          pages: iss.pages.map(pg => {
            if (pg.id !== action.pageId) return pg;
            const newPanels: Panel[] = template.panels.map(config => ({
              id: genId(), prompt: '', aspectRatio: config.aspectRatio,
              characterIds: [], textElements: [],
              x: config.x, y: config.y, width: config.width, height: config.height,
            }));
            return { ...pg, panels: newPanels };
          }),
        })),
      }));
      break;
    }

    case 'UNDO':
    case 'REDO':
      break;
  }

  return newState;
}

// =============================================================================
// HISTORY WRAPPER — preserves undo/redo exactly as before
// =============================================================================

const NON_HISTORICAL_ACTIONS = new Set([
  'HYDRATE', 'SET_ACTIVE_PROJECT', 'SET_ACTIVE_ISSUE', 'SET_ACTIVE_PAGE', 'UNDO', 'REDO',
]);

function inkHistoryReducer(stateWithHistory: InkStateWithHistory, action: InkAction): InkStateWithHistory {
  const { past, present, future } = stateWithHistory;

  switch (action.type) {
    case 'HYDRATE':
      return { past: [], present: inkAppReducer(present, action), future: [] };

    case 'UNDO': {
      if (past.length === 0) return stateWithHistory;
      const previous = past[past.length - 1];
      return { past: past.slice(0, -1), present: previous, future: [present, ...future] };
    }

    case 'REDO': {
      if (future.length === 0) return stateWithHistory;
      const next = future[0];
      return { past: [...past, present], present: next, future: future.slice(1) };
    }

    default: {
      const newPresent = inkAppReducer(present, action);
      if (newPresent === present) return stateWithHistory;
      if (NON_HISTORICAL_ACTIONS.has(action.type)) {
        return { past, present: newPresent, future };
      }
      return { past: [...past, present].slice(-MAX_HISTORY), present: newPresent, future: [] };
    }
  }
}

// =============================================================================
// DEFAULT STATE
// =============================================================================

function createDefaultInkState(): InkAppState {
  // Try loading from existing Ink Tracker localStorage
  const saved = localStorage.getItem('ink_tracker_data');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.projects) return normalizeInkProjects(parsed);
    } catch (e) {
      console.error('Failed to load ink_tracker_data:', e);
    }
  }

  return {
    projects: [{
      id: genId(), title: 'New Story', style: 'classic-noir', issueType: 'issue',
      imageProvider: 'gemini', projectType: 'comic', fluxModel: 'fal-ai/flux-pro',
      issues: [{ id: 'i1', title: 'Issue #1', pages: [{ id: 'pg1', number: 1, panels: [] }] }],
    }],
    activeProjectId: null,
    activeIssueId: null,
    activePageId: null,
  };
}

function normalizeInkProjects(state: InkAppState): InkAppState {
  return {
    ...state,
    projects: state.projects.map(proj => ({
      ...proj,
      issueType: proj.issueType || 'issue',
      imageProvider: proj.imageProvider || 'gemini',
      projectType: proj.projectType || 'comic',
      fluxModel: proj.fluxModel || 'fal-ai/flux-pro',
      panelFrameStyle: proj.panelFrameStyle || 'opaque-black',
      textOverlayStyle: proj.textOverlayStyle || 'opaque',
      issues: (proj.issues || []).map(iss => ({
        ...iss,
        pages: (iss.pages || []).map(pg => ({
          ...pg,
          panels: (pg.panels || []).map(pan => ({
            ...pan,
            textElements: pan.textElements || [],
            characterIds: pan.characterIds || [],
          })),
        })),
      })),
    })),
  };
}

// =============================================================================
// ZUSTAND SLICE
// =============================================================================
// This is the "thin wrapper" — the full Ink Tracker state lives inside
// inkHistory as an InkStateWithHistory blob. Components access:
//   - inkState        → the "present" InkAppState
//   - inkDispatch()   → fires actions through the history reducer
//   - inkCanUndo      → boolean
//   - inkCanRedo      → boolean
//
// Your existing Ink Tracker components just need to swap:
//   const { inkState, inkDispatch } = useLitStore();
//   // then pass inkState as "state" and inkDispatch as "dispatch"
// =============================================================================

export interface InkSlice {
  inkHistory: InkStateWithHistory;
  inkState: InkAppState;         // convenience: always === inkHistory.present
  inkCanUndo: boolean;
  inkCanRedo: boolean;

  inkDispatch: (action: InkAction) => void;
}

export const createInkSlice: StateCreator<InkSlice, [], [], InkSlice> = (set, get) => {
  const initialState = createDefaultInkState();
  const initialHistory: InkStateWithHistory = {
    past: [],
    present: initialState,
    future: [],
  };

  return {
    inkHistory: initialHistory,
    inkState: initialState,
    inkCanUndo: false,
    inkCanRedo: false,

    inkDispatch: (action: InkAction) => {
      set((prev) => {
        const newHistory = inkHistoryReducer(prev.inkHistory, action);

        // Persist to localStorage (same key as original Ink Tracker for migration compat)
        localStorage.setItem('ink_tracker_data', JSON.stringify(newHistory.present));

        return {
          inkHistory: newHistory,
          inkState: newHistory.present,
          inkCanUndo: newHistory.past.length > 0,
          inkCanRedo: newHistory.future.length > 0,
        };
      });
    },
  };
};
