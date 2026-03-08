import { create } from "zustand";
import type { BucketInfo, ObjectInfo } from "../types";
import { api } from "../lib/tauri";
import { useProfileStore } from "./profileStore";

interface ExplorerStore {
  buckets: BucketInfo[];
  currentBucket: string | null;
  currentPrefix: string;
  objects: ObjectInfo[];
  loading: boolean;
  searchQuery: string;
  selectedKeys: Set<string>;
  fetchBuckets: (profileId: string) => Promise<void>;
  setCurrentBucket: (bucket: string) => void;
  navigateToPrefix: (prefix: string) => Promise<void>;
  navigateUp: () => Promise<void>;
  fetchObjects: (profileId: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  toggleSelection: (key: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  buckets: [],
  currentBucket: null,
  currentPrefix: "",
  objects: [],
  loading: false,
  searchQuery: "",
  selectedKeys: new Set<string>(),

  fetchBuckets: async (profileId: string) => {
    set({ loading: true });
    try {
      const buckets = await api.listBuckets(profileId);
      set({ buckets });
    } catch (err) {
      console.error("Failed to fetch buckets:", err);
      set({ buckets: [] });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentBucket: (bucket: string) => {
    set({
      currentBucket: bucket,
      currentPrefix: "",
      objects: [],
      selectedKeys: new Set(),
      searchQuery: "",
    });
  },

  navigateToPrefix: async (prefix: string) => {
    set({
      currentPrefix: prefix,
      objects: [],
      selectedKeys: new Set(),
      searchQuery: "",
    });
    const profileId = useProfileStore.getState().activeProfileId;
    if (profileId) {
      await get().fetchObjects(profileId);
    }
  },

  navigateUp: async () => {
    const { currentPrefix } = get();
    if (!currentPrefix) return;
    const parts = currentPrefix.replace(/\/$/, "").split("/");
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join("/") + "/" : "";
    set({
      currentPrefix: newPrefix,
      objects: [],
      selectedKeys: new Set(),
    });
    const profileId = useProfileStore.getState().activeProfileId;
    if (profileId) {
      await get().fetchObjects(profileId);
    }
  },

  fetchObjects: async (profileId: string) => {
    const { currentBucket, currentPrefix } = get();
    if (!currentBucket) return;

    set({ loading: true });
    try {
      const result = await api.listObjects(
        profileId,
        currentBucket,
        currentPrefix
      );
      set({ objects: result.objects });
    } catch (err) {
      console.error("Failed to fetch objects:", err);
      set({ objects: [] });
    } finally {
      set({ loading: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  toggleSelection: (key: string) => {
    set((state) => {
      const newSelection = new Set(state.selectedKeys);
      if (newSelection.has(key)) {
        newSelection.delete(key);
      } else {
        newSelection.add(key);
      }
      return { selectedKeys: newSelection };
    });
  },

  selectAll: () => {
    set((state) => {
      const allKeys = new Set(state.objects.map((o) => o.key));
      return { selectedKeys: allKeys };
    });
  },

  clearSelection: () => {
    set({ selectedKeys: new Set() });
  },
}));
