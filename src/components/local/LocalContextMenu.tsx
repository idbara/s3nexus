import { useEffect, useRef } from "react";
import {
  Upload,
  FolderOpen,
  ClipboardCopy,
  Trash2,
} from "lucide-react";

interface LocalContextMenuProps {
  x: number;
  y: number;
  isDirectory: boolean;
  hasS3Bucket: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function LocalContextMenu({
  x,
  y,
  isDirectory,
  hasS3Bucket,
  onClose,
  onAction,
}: LocalContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const items = [
    ...(isDirectory
      ? [{ id: "open", label: "Open", icon: FolderOpen }]
      : []),
    ...(hasS3Bucket
      ? [{ id: "uploadToS3", label: "Upload to S3", icon: Upload }]
      : []),
    { id: "separator1", label: "", icon: null },
    { id: "copyPath", label: "Copy Path", icon: ClipboardCopy },
    { id: "delete", label: "Delete", icon: Trash2, danger: true },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[60] min-w-[200px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      {items.map((item) => {
        if (item.id.startsWith("separator")) {
          return (
            <div
              key={item.id}
              className="my-1 border-t border-gray-100 dark:border-gray-700"
            />
          );
        }
        const Icon = item.icon!;
        const isDanger = (item as { danger?: boolean }).danger;
        return (
          <button
            key={item.id}
            onClick={() => {
              onAction(item.id);
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors ${
              isDanger
                ? "text-danger hover:bg-red-50 dark:hover:bg-red-900/20"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
