import { useRef, useCallback, useState, type DragEvent } from "react";
import { LocalToolbar } from "../local/LocalToolbar";
import { LocalBreadcrumb } from "../local/LocalBreadcrumb";
import { LocalExplorer } from "../local/LocalExplorer";
import { Toolbar } from "./Toolbar";
import { Breadcrumb } from "./Breadcrumb";
import { FileExplorer } from "../explorer/FileExplorer";
import { useExplorerStore } from "../../stores/explorerStore";
import { useLocalExplorerStore } from "../../stores/localExplorerStore";
import { useProfileStore } from "../../stores/profileStore";
import { useTransferStore } from "../../stores/transferStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";

export function DualPanelLayout() {
  const [leftPercent, setLeftPercent] = useState(50);
  const [dragOverLeft, setDragOverLeft] = useState(false);
  const [dragOverRight, setDragOverRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const { currentBucket, currentPrefix, fetchObjects } = useExplorerStore();
  const { currentPath, refresh } = useLocalExplorerStore();
  const { activeProfileId } = useProfileStore();
  const { openPanel } = useTransferStore();
  const { addToast } = useToastStore();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      setLeftPercent(Math.max(20, Math.min(80, percent)));
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Left panel: accepts S3 drops → download
  const handleLeftDragOver = useCallback(
    (e: DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-s3nexus-s3")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOverLeft(true);
      }
    },
    []
  );

  const handleLeftDragLeave = useCallback(() => {
    setDragOverLeft(false);
  }, []);

  const handleLeftDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragOverLeft(false);

      const raw = e.dataTransfer.getData("application/x-s3nexus-s3");
      if (!raw) return;

      if (!activeProfileId || !currentBucket) {
        addToast("No S3 bucket selected", "warning");
        return;
      }
      if (!currentPath) {
        addToast("No local directory selected", "warning");
        return;
      }

      try {
        const { keys } = JSON.parse(raw) as { keys: string[] };
        await api.downloadFiles(activeProfileId, currentBucket, keys, currentPath);
        openPanel();
        addToast(
          `Downloading ${keys.length} item${keys.length > 1 ? "s" : ""} to local`,
          "success"
        );
        refresh();
      } catch (err) {
        addToast(`Download failed: ${err}`, "error");
      }
    },
    [activeProfileId, currentBucket, currentPath, addToast, openPanel, refresh]
  );

  // Right panel: accepts local drops → upload
  const handleRightDragOver = useCallback(
    (e: DragEvent) => {
      if (e.dataTransfer.types.includes("application/x-s3nexus-local")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragOverRight(true);
      }
    },
    []
  );

  const handleRightDragLeave = useCallback(() => {
    setDragOverRight(false);
  }, []);

  const handleRightDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setDragOverRight(false);

      const raw = e.dataTransfer.getData("application/x-s3nexus-local");
      if (!raw) return;

      if (!activeProfileId || !currentBucket) {
        addToast("Select an S3 bucket first", "warning");
        return;
      }

      try {
        const { paths } = JSON.parse(raw) as { paths: string[] };
        await api.uploadFiles(activeProfileId, currentBucket, currentPrefix, paths);
        openPanel();
        addToast(
          `Uploading ${paths.length} item${paths.length > 1 ? "s" : ""} to S3`,
          "success"
        );
        fetchObjects(activeProfileId);
      } catch (err) {
        addToast(`Upload failed: ${err}`, "error");
      }
    },
    [activeProfileId, currentBucket, currentPrefix, addToast, openPanel, fetchObjects]
  );

  return (
    <div ref={containerRef} className="flex-1 flex min-h-0">
      {/* Left panel: Local files */}
      <div
        className={cn(
          "flex flex-col min-w-0 border-r border-gray-200 dark:border-gray-700 transition-shadow",
          dragOverLeft && "ring-2 ring-primary/50"
        )}
        style={{ flexBasis: `${leftPercent}%`, flexShrink: 0, flexGrow: 0 }}
        onDragOver={handleLeftDragOver}
        onDragLeave={handleLeftDragLeave}
        onDrop={handleLeftDrop}
      >
        <LocalToolbar />
        <LocalBreadcrumb />
        <div className="flex-1 overflow-auto">
          <LocalExplorer />
        </div>
      </div>

      {/* Divider */}
      <div
        className="w-1 cursor-col-resize bg-gray-200 dark:bg-gray-700 hover:bg-primary/40 active:bg-primary/60 transition-colors flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* Right panel: S3 browser */}
      <div
        className={cn(
          "flex flex-col min-w-0 flex-1 transition-shadow",
          dragOverRight && "ring-2 ring-primary/50"
        )}
        onDragOver={handleRightDragOver}
        onDragLeave={handleRightDragLeave}
        onDrop={handleRightDrop}
      >
        <Toolbar />
        <Breadcrumb />
        <div className="flex-1 overflow-auto">
          <FileExplorer />
        </div>
      </div>
    </div>
  );
}
