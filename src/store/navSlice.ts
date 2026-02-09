import { StateCreator } from 'zustand';
import { ModuleId } from '../types';

export interface NavSlice {
  activeModule: ModuleId;
  isCommandPaletteOpen: boolean;
  syncStatus: 'idle' | 'saving' | 'synced' | 'error';
  projectName: string;

  setActiveModule: (module: ModuleId) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSyncStatus: (status: 'idle' | 'saving' | 'synced' | 'error') => void;
  setProjectName: (name: string) => void;
}

export const createNavSlice: StateCreator<NavSlice, [], [], NavSlice> = (set) => ({
  activeModule: 'characters',
  isCommandPaletteOpen: false,
  syncStatus: 'idle',
  projectName: 'Untitled Project',

  setActiveModule: (module) => set({ activeModule: module }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSyncStatus: (status) => set({ syncStatus: status }),
  setProjectName: (name) => set({ projectName: name }),
});
