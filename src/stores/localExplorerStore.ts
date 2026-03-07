import { create } from "zustand";
import type { LocalFileEntry, DriveInfo } from "../types";
import { api } from "../lib/tauri";

interface LocalExplorerStore {
  currentPath: string;
  entries: LocalFileEntry[];
  drives: DriveInfo[];
  loading: boolean;
  searchQuery: string;
  selectedPaths: Set<string>;
  initialized: boolean;
  showHidden: boolean;
  initialize: () => Promise<void>;
  fetchDirectory: (path: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleSelection: (path: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  refresh: () => Promise<void>;
  toggleShowHidden: () => void;
}

export const useLocalExplorerStore = create<LocalExplorerStore>((set, get) => ({
  currentPath: "",
  entries: [],
  drives: [],
  loading: false,
  searchQuery: "",
  selectedPaths: new Set<string>(),
  initialized: false,
  showHidden: false,

  initialize: async () => {
    if (get().initialized) return;
    try {
      const [home, drives] = await Promise.all([
        api.getHomeDirectory(),
        api.getDrives(),
      ]);
      set({ drives, initialized: true });
      await get().fetchDirectory(home);
    } catch (err) {
      console.error("Failed to initialize local explorer:", err);
    }
  },

  fetchDirectory: async (path: string) => {
    set({ loading: true });
    try {
      const entries = await api.listDirectory(path);
      set({
        currentPath: path,
        entries,
        selectedPaths: new Set(),
        searchQuery: "",
      });
    } catch (err) {
      console.error("Failed to list directory:", err);
      set({ entries: [] });
    } finally {
      set({ loading: false });
    }
  },

  navigateTo: async (path: string) => {
    await get().fetchDirectory(path);
  },

  navigateUp: async () => {
    const { currentPath } = get();
    if (!currentPath) return;
    const normalized = currentPath.replace(/\/$/, "");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
      // We're at root (e.g., "/home" -> "/") or drive root
      const parent = normalized.substring(0, lastSlash + 1) || "/";
      await get().fetchDirectory(parent);
    } else {
      const parent = normalized.substring(0, lastSlash);
      await get().fetchDirectory(parent);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  toggleSelection: (path: string) => {
    set((state) => {
      const newSelection = new Set(state.selectedPaths);
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
      return { selectedPaths: newSelection };
    });
  },

  selectAll: () => {
    set((state) => {
      const allPaths = new Set(state.entries.map((e) => e.path));
      return { selectedPaths: allPaths };
    });
  },

  clearSelection: () => {
    set({ selectedPaths: new Set() });
  },

  refresh: async () => {
    const { currentPath } = get();
    if (currentPath) {
      await get().fetchDirectory(currentPath);
    }
  },

  toggleShowHidden: () => {
    set((state) => ({ showHidden: !state.showHidden }));
  },
}));
