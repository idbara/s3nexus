import { useEffect, useState, useCallback, useMemo, type DragEvent } from "react";
import { ArrowUp } from "lucide-react";
import { useExplorerStore } from "../../stores/explorerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useModalStore } from "../../stores/modalStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { FileRow } from "./FileRow";
import { ContextMenu } from "./ContextMenu";
import { EmptyState } from "./EmptyState";
import { errMsg } from "../../lib/utils";
import type { ObjectInfo } from "../../types";

export function FileExplorer() {
  const {
    objects,
    currentBucket,
    currentPrefix,
    loading,
    searchQuery,
    selectedKeys,
    fetchObjects,
    navigateToPrefix,
    navigateUp,
    toggleSelection,
    selectAll,
    clearSelection,
  } = useExplorerStore();
  const { activeProfileId } = useProfileStore();
  const { openModal } = useModalStore();
  const { addToast } = useToastStore();

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    object: ObjectInfo;
  } | null>(null);

  useEffect(() => {
    if (activeProfileId && currentBucket) {
      fetchObjects(activeProfileId);
    }
    // currentPrefix is NOT a dep — navigateToPrefix/navigateUp fetch directly
  }, [activeProfileId, currentBucket, fetchObjects]);

  const filteredObjects = useMemo(() => {
    if (!searchQuery) return objects;
    const q = searchQuery.toLowerCase();
    return objects.filter((o) => o.display_name.toLowerCase().includes(q));
  }, [objects, searchQuery]);

  const sortedObjects = useMemo(() => {
    const folders = filteredObjects.filter((o) => o.is_folder);
    const files = filteredObjects.filter((o) => !o.is_folder);
    folders.sort((a, b) => a.display_name.localeCompare(b.display_name));
    files.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return [...folders, ...files];
  }, [filteredObjects]);

  const handleClick = useCallback(
    (object: ObjectInfo) => {
      if (object.is_folder) {
        navigateToPrefix(object.key);
      } else {
        toggleSelection(object.key);
      }
    },
    [navigateToPrefix, toggleSelection]
  );

  const handleDoubleClick = useCallback(
    (object: ObjectInfo) => {
      if (object.is_folder) {
        navigateToPrefix(object.key);
      } else {
        openModal("preview", { objectKey: object.key, object });
      }
    },
    [navigateToPrefix, openModal]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, object: ObjectInfo) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, object });
    },
    []
  );

  const handleDragStart = useCallback(
    (e: DragEvent, object: ObjectInfo) => {
      const keys = selectedKeys.has(object.key)
        ? Array.from(selectedKeys)
        : [object.key];
      e.dataTransfer.setData(
        "application/x-s3nexus-s3",
        JSON.stringify({ keys })
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [selectedKeys]
  );

  const handleContextAction = useCallback(
    async (action: string) => {
      if (!contextMenu || !activeProfileId || !currentBucket) return;
      const obj = contextMenu.object;

      switch (action) {
        case "download":
          try {
            const savePath = `${obj.display_name}`;
            await api.downloadFile(
              activeProfileId,
              currentBucket,
              obj.key,
              savePath
            );
            addToast(`Download started: ${obj.display_name}`, "success");
          } catch (err) {
            addToast(`Download failed: ${errMsg(err)}`, "error");
          }
          break;
        case "preview":
          openModal("preview", { objectKey: obj.key, object: obj });
          break;
        case "presigned":
          openModal("presignedUrl", { objectKey: obj.key, object: obj });
          break;
        case "acl":
          openModal("aclEditor", { objectKey: obj.key, object: obj });
          break;
        case "versions":
          openModal("versionHistory", { objectKey: obj.key, object: obj });
          break;
        case "rename":
          openModal("rename", { objectKey: obj.key, object: obj });
          break;
        case "copyKey":
          await navigator.clipboard.writeText(obj.key);
          addToast("Key copied to clipboard", "success");
          break;
        case "delete":
          openModal("deleteConfirm", { objectKey: obj.key, object: obj });
          break;
      }
    },
    [contextMenu, activeProfileId, currentBucket, addToast, openModal]
  );

  const allSelected =
    sortedObjects.length > 0 &&
    sortedObjects.every((o) => selectedKeys.has(o.key));

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  };

  if (!currentBucket) {
    return <EmptyState hasBucket={false} />;
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

  if (sortedObjects.length === 0 && !searchQuery) {
    return <EmptyState hasBucket={true} />;
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
          {currentPrefix && (
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
          )}
          {sortedObjects.map((object) => (
            <FileRow
              key={object.key}
              object={object}
              selected={selectedKeys.has(object.key)}
              onSelect={toggleSelection}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              draggable={true}
              onDragStart={handleDragStart}
            />
          ))}
        </tbody>
      </table>

      {searchQuery && sortedObjects.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
          No files matching "{searchQuery}"
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFolder={contextMenu.object.is_folder}
          objectKey={contextMenu.object.key}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
