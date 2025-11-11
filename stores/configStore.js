import { create } from 'zustand';

export const useConfigStore = create((set) => ({
  isLargeFont: false,
  toggleLargeFont: () => set((state) => ({ isLargeFont: !state.isLargeFont })),
}));
