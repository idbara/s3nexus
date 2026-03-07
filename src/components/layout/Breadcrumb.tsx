import { Home, ChevronRight } from "lucide-react";
import { useExplorerStore } from "../../stores/explorerStore";

export function Breadcrumb() {
  const { currentBucket, currentPrefix, navigateToPrefix } =
    useExplorerStore();

  if (!currentBucket) return null;

  const prefixParts = currentPrefix
    .split("/")
    .filter((p) => p.length > 0);

  const handleSegmentClick = (index: number) => {
    if (index === -1) {
      navigateToPrefix("");
      return;
    }
    const prefix = prefixParts.slice(0, index + 1).join("/") + "/";
    navigateToPrefix(prefix);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-2 text-sm bg-gray-50 dark:bg-[#1a1a2e] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      <button
        onClick={() => handleSegmentClick(-1)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
        title="Bucket root"
      >
        <Home className="w-3.5 h-3.5" />
      </button>

      <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />

      <button
        onClick={() => handleSegmentClick(-1)}
        className="px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/10 transition-colors font-medium flex-shrink-0"
      >
        {currentBucket}
      </button>

      {prefixParts.map((part, index) => (
        <span key={index} className="flex items-center gap-1 flex-shrink-0">
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
          <button
            onClick={() => handleSegmentClick(index)}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              index === prefixParts.length - 1
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
