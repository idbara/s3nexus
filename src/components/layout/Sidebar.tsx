import { useEffect } from "react";
import {
  Database,
  Plus,
  FolderOpen,
  ChevronDown,
  Users,
  Settings,
  FolderSync,
  Eye,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useThemeStore } from "../../stores/themeStore";
import { useModalStore } from "../../stores/modalStore";
import { cn } from "../../lib/utils";

export function Sidebar() {
  const {
    profiles,
    activeProfileId,
    fetchProfiles,
    setActiveProfile,
  } = useProfileStore();
  const { buckets, currentBucket, fetchBuckets, setCurrentBucket } =
    useExplorerStore();
  const { theme, setTheme, resolved } = useThemeStore();
  const { openModal } = useModalStore();

  const cycleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (activeProfileId) {
      fetchBuckets(activeProfileId);
    }
  }, [activeProfileId, fetchBuckets]);

  return (
    <aside className="w-64 h-full flex flex-col bg-gray-50 dark:bg-[#181825] border-r border-gray-200 dark:border-gray-700 select-none">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Database className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            S3 Nexus
          </span>
        </div>

        <div className="relative">
          <select
            value={activeProfileId || ""}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-8 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary cursor-pointer"
          >
            {profiles.length === 0 && (
              <option value="">No profiles</option>
            )}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.provider})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <button
          onClick={() => openModal("profileForm")}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Profile
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Buckets
          </span>
        </div>
        {buckets.length === 0 && activeProfileId && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            No buckets found
          </div>
        )}
        {!activeProfileId && (
          <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Select a profile to browse
          </div>
        )}
        {buckets.map((b) => (
          <button
            key={b.name}
            onClick={() => setCurrentBucket(b.name)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
              currentBucket === b.name
                ? "bg-primary/10 text-primary dark:text-blue-400 font-medium"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
            )}
          >
            <FolderOpen
              className={cn(
                "w-4 h-4 flex-shrink-0",
                currentBucket === b.name
                  ? "text-primary"
                  : "text-gray-400 dark:text-gray-500"
              )}
            />
            <span className="truncate">{b.name}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex flex-col gap-0.5">
        <button
          onClick={() => openModal("syncModal")}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <FolderSync className="w-4 h-4" />
          Sync
        </button>
        <button
          onClick={() =>
            openModal("settings")
          }
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          Monitors
        </button>
        <button
          onClick={() => openModal("settings")}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={() => openModal("profileList")}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <Users className="w-4 h-4" />
          Manage Profiles
        </button>
        <button
          onClick={cycleTheme}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          title={`Theme: ${theme}`}
        >
          {resolved === "dark" ? (
            <Moon className="w-4 h-4" />
          ) : theme === "system" ? (
            <Monitor className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
          Theme
        </button>
      </div>
    </aside>
  );
}
