import { create } from "zustand";
import type { Profile, ProfileInput } from "../types";
import { api } from "../lib/tauri";

interface ProfileStore {
  profiles: Profile[];
  activeProfileId: string | null;
  loading: boolean;
  fetchProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => void;
  createProfile: (input: ProfileInput) => Promise<Profile>;
  updateProfile: (id: string, input: ProfileInput) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  loading: false,

  fetchProfiles: async () => {
    set({ loading: true });
    try {
      const profiles = await api.getProfiles();
      set({ profiles });
      if (!get().activeProfileId && profiles.length > 0) {
        set({ activeProfileId: profiles[0].id });
      }
    } catch (err) {
      console.error("Failed to fetch profiles:", err);
    } finally {
      set({ loading: false });
    }
  },

  setActiveProfile: (id: string) => {
    set({ activeProfileId: id });
  },

  createProfile: async (input: ProfileInput) => {
    const profile = await api.createProfile(input);
    set((state) => ({
      profiles: [...state.profiles, profile],
      activeProfileId: state.activeProfileId ?? profile.id,
    }));
    return profile;
  },

  updateProfile: async (id: string, input: ProfileInput) => {
    const profile = await api.updateProfile(id, input);
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === id ? profile : p)),
    }));
    return profile;
  },

  deleteProfile: async (id: string) => {
    await api.deleteProfile(id);
    set((state) => {
      const profiles = state.profiles.filter((p) => p.id !== id);
      return {
        profiles,
        activeProfileId:
          state.activeProfileId === id
            ? profiles.length > 0
              ? profiles[0].id
              : null
            : state.activeProfileId,
      };
    });
  },
}));
