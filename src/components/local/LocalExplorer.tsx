import { useEffect, useState, useCallback, useMemo, type DragEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useLocalExplorerStore } from "../../stores/localExplorerStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useTransferStore } from "../../stores/transferStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { FileRow } from "../explorer/FileRow";
import { LocalContextMenu } from "./LocalContextMenu";
import type { LocalFileEntry, ObjectInfo } from "../../types";
import { HardDrive } from "lucide-react";

function toObjectInfo(entry: LocalFileEntry): ObjectInfo {
  return {
    key: entry.path,
    display_name: entry.name,
    size: entry.size,
    last_modified: entry.modified,
    is_folder: entry.is_directory,
    storage_class: null,
    e_tag: null,
  };
}

export function LocalExplorer() {
  const {
    entries,
    currentPath,
    loading,
    searchQuery,
    selectedPaths,
    showHidden,
    initialize,
    navigateTo,
    navigateUp,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh,
  } = useLocalExplorerStore();
  const { currentBucket, currentPrefix } = useExplorerStore();
  const { activeProfileId } = useProfileStore();
  const { openPanel } = useTransferStore();
  const { addToast } = useToastStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: LocalFileEntry;
  } | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (!showHidden) {
      result = result.filter((e) => !e.is_hidden);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.name.toLowerCase().includes(q));
    }
    return result;
  }, [entries, searchQuery, showHidden]);

  const handleClick = useCallback(
    (object: ObjectInfo) => {
      if (object.is_folder) {
        navigateTo(object.key);
      } else {
        toggleSelection(object.key);
      }
    },
    [navigateTo, toggleSelection]
  );

  const handleDoubleClick = useCallback(
    (object: ObjectInfo) => {
      if (object.is_folder) {
        navigateTo(object.key);
      }
      // For files, we could open with OS default - but that requires a Tauri command
    },
    [navigateTo]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, object: ObjectInfo) => {
      e.preventDefault();
      const entry = entries.find((en) => en.path === object.key);
      if (entry) {
        setContextMenu({ x: e.clientX, y: e.clientY, entry });
      }
    },
    [entries]
  );

  const handleDragStart = useCallback(
    (e: DragEvent, object: ObjectInfo) => {
      const paths = selectedPaths.has(object.key)
        ? Array.from(selectedPaths)
        : [object.key];
      e.dataTransfer.setData(
        "application/x-s3nexus-local",
        JSON.stringify({ paths })
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [selectedPaths]
  );

  const handleContextAction = useCallback(
    async (action: string) => {
      if (!contextMenu) return;
      const entry = contextMenu.entry;

      switch (action) {
        case "open":
          if (entry.is_directory) {
            navigateTo(entry.path);
          }
          break;
        case "uploadToS3":
          if (!activeProfileId || !currentBucket) {
            addToast("Select an S3 bucket first", "warning");
            return;
          }
          try {
            await api.uploadFiles(activeProfileId, currentBucket, currentPrefix, [entry.path]);
            openPanel();
            addToast(`Uploading ${entry.name} to S3`, "success");
          } catch (err) {
            addToast(`Upload failed: ${err}`, "error");
          }
          break;
        case "copyPath":
          await navigator.clipboard.writeText(entry.path);
          addToast("Path copied to clipboard", "success");
          break;
        case "delete":
          try {
            await api.deleteLocalFiles([entry.path]);
            await refresh();
            addToast(`Deleted: ${entry.name}`, "success");
          } catch (err) {
            addToast(`Delete failed: ${err}`, "error");
          }
          break;
      }
    },
    [contextMenu, activeProfileId, currentBucket, currentPrefix, addToast, navigateTo, openPanel, refresh]
  );

  const allSelected =
    filteredEntries.length > 0 &&
    filteredEntries.every((e) => selectedPaths.has(e.path));

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  if (!currentPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <HardDrive className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Local Files
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Loading your filesystem...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="w-10 px-3 py-2" />
              <th className="py-2 pr-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="py-2 pr-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                Size
              </th>
              <th className="py-2 pr-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                Modified
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(8)].map((_, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-800"
              >
                <td className="px-3 py-2.5">
                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div
                      className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                      style={{ width: `${120 + Math.random() * 180}px` }}
                    />
                  </div>
                </td>
                <td className="py-2.5 pr-3">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                </td>
                <td className="py-2.5 pr-3">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-white dark:bg-[#1e1e2e] z-10">
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="w-10 px-3 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary cursor-pointer"
              />
            </th>
            <th className="py-2 pr-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Name
            </th>
            <th className="py-2 pr-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
              Size
            </th>
            <th className="py-2 pr-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
              Modified
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            className="group cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            onClick={() => navigateUp()}
          >
            <td className="px-3 py-2" />
            <td className="py-2 pr-3" colSpan={3}>
              <div className="flex items-center gap-2.5 text-sm text-gray-500 dark:text-gray-400">
                <ArrowUp className="w-4 h-4" />
                <span>..</span>
              </div>
            </td>
          </tr>
          {filteredEntries.map((entry) => {
            const obj = toObjectInfo(entry);
            return (
              <FileRow
                key={entry.path}
                object={obj}
                selected={selectedPaths.has(entry.path)}
                onSelect={toggleSelection}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                draggable={true}
                onDragStart={handleDragStart}
              />
            );
          })}
        </tbody>
      </table>

      {searchQuery && filteredEntries.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
          No files matching "{searchQuery}"
        </div>
      )}

      {!searchQuery && filteredEntries.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
          This folder is empty
        </div>
      )}

      {contextMenu && (
        <LocalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDirectory={contextMenu.entry.is_directory}
          hasS3Bucket={!!activeProfileId && !!currentBucket}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
