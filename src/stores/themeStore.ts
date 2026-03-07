import { create } from "zustand";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeStore {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  initialize: () => void;
}

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === "system") return getSystemTheme();
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "system",
  resolved: "light",

  setTheme: (theme: ThemeMode) => {
    const resolved = resolveTheme(theme);
    localStorage.setItem("s3nexus-theme", theme);
    applyTheme(resolved);
    set({ theme, resolved });
  },

  initialize: () => {
    const stored = localStorage.getItem("s3nexus-theme") as ThemeMode | null;
    const theme = stored || "system";
    const resolved = resolveTheme(theme);
    applyTheme(resolved);
    set({ theme, resolved });

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      const currentTheme = localStorage.getItem("s3nexus-theme") as ThemeMode | null;
      if (!currentTheme || currentTheme === "system") {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  },
}));
