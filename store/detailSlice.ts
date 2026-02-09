import { StateCreator } from 'zustand';

export type DetailTarget =
  | { kind: 'character'; id: string }
  | { kind: 'lore'; id: string }
  | null;

export interface DetailSlice {
  detailTarget: DetailTarget;
  detailHistory: DetailTarget[];

  // Actions
  openDetail: (target: DetailTarget) => void;
  closeDetail: () => void;
  goBackDetail: () => void;
}

export const createDetailSlice: StateCreator<DetailSlice, [], [], DetailSlice> = (set) => ({
  detailTarget: null,
  detailHistory: [],

  openDetail: (target) => set((state) => {
    // If something is already open, push it to history so we can go back
    if (state.detailTarget && target && (
      state.detailTarget.kind !== target.kind || state.detailTarget.id !== target.id
    )) {
      return {
        detailTarget: target,
        detailHistory: [...state.detailHistory, state.detailTarget].slice(-20), // keep last 20
      };
    }
    return { detailTarget: target, detailHistory: state.detailHistory };
  }),

  closeDetail: () => set({ detailTarget: null, detailHistory: [] }),

  goBackDetail: () => set((state) => {
    if (state.detailHistory.length === 0) return { detailTarget: null };
    const prev = state.detailHistory[state.detailHistory.length - 1];
    return {
      detailTarget: prev,
      detailHistory: state.detailHistory.slice(0, -1),
    };
  }),
});
