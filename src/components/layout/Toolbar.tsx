import { useRef, useCallback, useState } from "react";
import {
  Upload,
  Download,
  FolderPlus,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react";
import { useExplorerStore } from "../../stores/explorerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useLocalExplorerStore } from "../../stores/localExplorerStore";
import { useTransferStore } from "../../stores/transferStore";
import { useModalStore } from "../../stores/modalStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { Button } from "../ui/Button";

export function Toolbar() {
  const {
    selectedKeys,
    clearSelection,
    currentBucket,
    fetchObjects,
    setSearchQuery,
    searchQuery,
  } = useExplorerStore();
  const { activeProfileId } = useProfileStore();
  const { currentPath: localPath, refresh: refreshLocal } = useLocalExplorerStore();
  const { openPanel } = useTransferStore();
  const { openModal } = useModalStore();
  const { addToast } = useToastStore();
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
    if (!activeProfileId) return;
    setRefreshing(true);
    try {
      await fetchObjects(activeProfileId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProfileId || !currentBucket || selectedKeys.size === 0) return;
    const keys = Array.from(selectedKeys);
    try {
      await api.deleteObjects(activeProfileId, currentBucket, keys);
      clearSelection();
      await fetchObjects(activeProfileId);
      addToast(`Deleted ${keys.length} item(s)`, "success");
    } catch (err) {
      addToast(`Delete failed: ${err}`, "error");
    }
  };

  const handleUpload = () => {
    if (!activeProfileId || !currentBucket) {
      addToast("Select a bucket first", "warning");
      return;
    }
    addToast("Use drag-and-drop or the file dialog to upload files", "info");
  };

  const handleNewFolder = () => {
    if (!activeProfileId || !currentBucket) {
      addToast("Select a bucket first", "warning");
      return;
    }
    openModal("newFolder");
  };

  const handleDownloadToLocal = async () => {
    if (!activeProfileId || !currentBucket || selectedKeys.size === 0) return;
    if (!localPath) {
      addToast("Local panel not ready", "warning");
      return;
    }

    const keys = Array.from(selectedKeys);
    setDownloading(true);
    try {
      await api.downloadFiles(activeProfileId, currentBucket, keys, localPath);
      openPanel();
      clearSelection();
      addToast(`Downloading ${keys.length} file(s) to ${localPath}`, "success");
      // Refresh local panel after a short delay to show new files
      setTimeout(() => refreshLocal(), 2000);
    } catch (err) {
      addToast(`Download failed: ${err}`, "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1e2e]">
      <Button
        variant="primary"
        size="sm"
        onClick={handleDownloadToLocal}
        disabled={selectedKeys.size === 0 || !localPath}
        loading={downloading}
        title="Download selected files to local panel directory"
      >
        <Download className="w-4 h-4" />
        <span className="hidden lg:inline">
          Download{selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ""}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleUpload}
        disabled={!currentBucket}
        title="Upload files"
      >
        <Upload className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleNewFolder}
        disabled={!currentBucket}
        title="Create folder"
      >
        <FolderPlus className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={selectedKeys.size === 0}
        title="Delete selected"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={!currentBucket}
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
