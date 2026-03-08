import { create } from "zustand";
import type { TransferTask, TransferProgressEvent } from "../types";
import { api } from "../lib/tauri";
import { useExplorerStore } from "./explorerStore";
import { useLocalExplorerStore } from "./localExplorerStore";
import { useProfileStore } from "./profileStore";

interface TransferStore {
  transfers: TransferTask[];
  isPanelOpen: boolean;
  fetchTransfers: () => Promise<void>;
  updateTransferProgress: (event: TransferProgressEvent) => void;
  togglePanel: () => void;
  openPanel: () => void;
  pauseTransfer: (id: string) => Promise<void>;
  resumeTransfer: (id: string) => Promise<void>;
  cancelTransfer: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
}

export const useTransferStore = create<TransferStore>((set) => ({
  transfers: [],
  isPanelOpen: false,

  fetchTransfers: async () => {
    try {
      const transfers = await api.getTransfers();
      set({ transfers });
    } catch (err) {
      console.error("Failed to fetch transfers:", err);
    }
  },

  updateTransferProgress: (event: TransferProgressEvent) => {
    set((state) => {
      const transfers = state.transfers.map((t) => {
        if (t.id !== event.transfer_id) return t;
        return {
          ...t,
          status: event.status as TransferTask["status"],
          bytes_transferred: event.bytes_transferred,
          file_size: event.total_bytes || t.file_size,
          speed_bps: event.speed_bps,
          eta_seconds: event.eta_seconds,
          parts_completed: event.parts_completed,
          parts_total: event.parts_total,
          error: event.error,
        };
      });
      return { transfers };
    });

    // Auto-refresh file panels when a transfer completes
    if (event.status === "completed") {
      const profileId = useProfileStore.getState().activeProfileId;
      const bucket = useExplorerStore.getState().currentBucket;
      if (profileId && bucket) {
        useExplorerStore.getState().fetchObjects(profileId);
      }
      useLocalExplorerStore.getState().refresh();
    }
  },

  togglePanel: () => {
    set((state) => ({ isPanelOpen: !state.isPanelOpen }));
  },

  openPanel: () => {
    set({ isPanelOpen: true });
  },

  pauseTransfer: async (id: string) => {
    try {
      await api.pauseTransfer(id);
      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === id ? { ...t, status: "paused" as const } : t
        ),
      }));
    } catch (err) {
      console.error("Failed to pause transfer:", err);
    }
  },

  resumeTransfer: async (id: string) => {
    try {
      await api.resumeTransfer(id);
      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === id ? { ...t, status: "in_progress" as const } : t
        ),
      }));
    } catch (err) {
      console.error("Failed to resume transfer:", err);
    }
  },

  cancelTransfer: async (id: string) => {
    try {
      await api.cancelTransfer(id);
      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === id ? { ...t, status: "cancelled" as const } : t
        ),
      }));
    } catch (err) {
      console.error("Failed to cancel transfer:", err);
    }
  },

  clearCompleted: async () => {
    try {
      await api.clearCompletedTransfers();
      set((state) => ({
        transfers: state.transfers.filter(
          (t) =>
            t.status !== "completed" &&
            t.status !== "failed" &&
            t.status !== "cancelled"
        ),
      }));
    } catch (err) {
      console.error("Failed to clear completed transfers:", err);
    }
  },
}));
