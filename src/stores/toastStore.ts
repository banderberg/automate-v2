import { create } from 'zustand';

interface ToastStore {
  message: string | null;
  type: 'success' | 'error';
  show(message: string, type?: 'success' | 'error'): void;
  clear(): void;
}

export const useToastStore = create<ToastStore>((set) => ({
  message: null,
  type: 'success',
  show(message, type = 'success') {
    set({ message, type });
  },
  clear() {
    set({ message: null });
  },
}));
