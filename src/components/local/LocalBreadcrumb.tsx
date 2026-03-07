import { HardDrive, ChevronRight } from "lucide-react";
import { useLocalExplorerStore } from "../../stores/localExplorerStore";

export function LocalBreadcrumb() {
  const { currentPath, drives, navigateTo } = useLocalExplorerStore();

  if (!currentPath) return null;

  const normalized = currentPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter((p) => p.length > 0);

  // Determine root segment: drive letter on Windows (e.g. "C:") or "/" on Unix
  const isDrivePath = /^[A-Za-z]:/.test(parts[0] || "");
  const rootLabel = isDrivePath ? parts[0] : "/";
  const rootPath = isDrivePath ? parts[0] + "/" : "/";
  const pathSegments = isDrivePath ? parts.slice(1) : parts;

  const handleSegmentClick = (index: number) => {
    if (index === -1) {
      navigateTo(rootPath);
      return;
    }
    const segments = isDrivePath ? parts.slice(0, index + 2) : parts.slice(0, index + 1);
    const path = isDrivePath
      ? segments[0] + "/" + segments.slice(1).join("/")
      : "/" + segments.join("/");
    navigateTo(path);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-50 dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      {drives.length > 1 ? (
        <select
          value={rootPath}
          onChange={(e) => navigateTo(e.target.value)}
          className="flex-shrink-0 appearance-none px-1.5 py-0.5 text-sm rounded bg-transparent text-gray-500 dark:text-gray-400 hover:text-primary cursor-pointer focus:outline-none"
        >
          {drives.map((d) => (
            <option key={d.path} value={d.path}>
              {d.name}
            </option>
          ))}
        </select>
      ) : (
        <button
          onClick={() => handleSegmentClick(-1)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
          title="Root"
        >
          <HardDrive className="w-3.5 h-3.5" />
        </button>
      )}

      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />

      <button
        onClick={() => handleSegmentClick(-1)}
        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors font-medium flex-shrink-0"
      >
        {rootLabel}
      </button>

      {pathSegments.map((part, index) => (
        <span key={index} className="flex items-center gap-1 flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
          <button
            onClick={() => handleSegmentClick(index)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              index === pathSegments.length - 1
                ? "text-gray-900 dark:text-gray-100 font-medium"
                : "text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/10"
            }`}
          >
            {part}
          </button>
        </span>
      ))}
    </div>
  );
}
