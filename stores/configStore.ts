
import { create } from 'zustand';

interface ConfigState {
  isLargeFont: boolean;
  toggleLargeFont: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  isLargeFont: false,
  toggleLargeFont: () => set((state) => ({ isLargeFont: !state.isLargeFont })),
}));
