import { useRef, useCallback, useState } from "react";
import {
  Upload,
  FolderPlus,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useLocalExplorerStore } from "../../stores/localExplorerStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useTransferStore } from "../../stores/transferStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { Button } from "../ui/Button";
import { errMsg } from "../../lib/utils";

export function LocalToolbar() {
  const {
    selectedPaths,
    clearSelection,
    currentPath,
    refresh,
    setSearchQuery,
    searchQuery,
  } = useLocalExplorerStore();
  const { currentBucket, currentPrefix } = useExplorerStore();
  const { activeProfileId } = useProfileStore();
  const { openPanel } = useTransferStore();
  const { addToast } = useToastStore();
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      searchTimerRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
    },
    [setSearchQuery]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (selectedPaths.size === 0) return;
    const paths = Array.from(selectedPaths);
    try {
      await api.deleteLocalFiles(paths);
      clearSelection();
      await refresh();
      addToast(`Deleted ${paths.length} item(s)`, "success");
    } catch (err) {
      addToast(`Delete failed: ${errMsg(err)}`, "error");
    }
  };

  const handleNewFolder = async () => {
    if (!currentPath) return;
    const name = prompt("New folder name:");
    if (!name) return;
    const folderPath = currentPath.replace(/\/$/, "") + "/" + name;
    try {
      await api.createLocalDirectory(folderPath);
      await refresh();
      addToast(`Created folder: ${name}`, "success");
    } catch (err) {
      addToast(`Failed to create folder: ${errMsg(err)}`, "error");
    }
  };

  const handleUploadToS3 = async () => {
    if (!activeProfileId || !currentBucket) {
      addToast("Select an S3 bucket first", "warning");
      return;
    }
    if (selectedPaths.size === 0) {
      addToast("Select files to upload", "warning");
      return;
    }

    // Only upload files, not directories
    const filePaths = Array.from(selectedPaths);
    setUploading(true);
    try {
      await api.uploadFiles(activeProfileId, currentBucket, currentPrefix, filePaths);
      openPanel();
      clearSelection();
      addToast(`Uploading ${filePaths.length} file(s) to S3`, "success");
    } catch (err) {
      addToast(`Upload failed: ${errMsg(err)}`, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1e2e]">
      <Button
        variant="primary"
        size="sm"
        onClick={handleUploadToS3}
        disabled={selectedPaths.size === 0 || !currentBucket}
        loading={uploading}
        title="Upload selected files to S3"
      >
        <Upload className="w-4 h-4" />
        <span className="hidden lg:inline">
          Upload to S3{selectedPaths.size > 0 ? ` (${selectedPaths.size})` : ""}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNewFolder}
        title="Create folder"
      >
        <FolderPlus className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={selectedPaths.size === 0}
        title="Delete selected"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        loading={refreshing}
        title="Refresh"
      >
        <RefreshCw className="w-4 h-4" />
      </Button>

      <div className="flex-1" />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search..."
          defaultValue={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary w-32 lg:w-48 transition-colors"
        />
      </div>
    </div>
  );
}
