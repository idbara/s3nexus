import { useEffect, useRef } from "react";
import {
  Download,
  Eye,
  Link,
  Shield,
  History,
  Edit3,
  Trash2,
  ClipboardCopy,
} from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  isFolder: boolean;
  objectKey: string;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function ContextMenu({
  x,
  y,
  isFolder,
  onClose,
  onAction,
}: ContextMenuProps) {
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

  const items = isFolder
    ? [
        { id: "download", label: "Download", icon: Download },
        { id: "rename", label: "Rename", icon: Edit3 },
        { id: "separator1", label: "", icon: null },
        { id: "acl", label: "Permissions", icon: Shield },
        { id: "separator2", label: "", icon: null },
        { id: "copyKey", label: "Copy Key", icon: ClipboardCopy },
        { id: "delete", label: "Delete", icon: Trash2, danger: true },
      ]
    : [
        { id: "download", label: "Download", icon: Download },
        { id: "preview", label: "Preview", icon: Eye },
        { id: "separator1", label: "", icon: null },
        { id: "presigned", label: "Generate Presigned URL", icon: Link },
        { id: "acl", label: "Permissions", icon: Shield },
        { id: "versions", label: "Version History", icon: History },
        { id: "separator2", label: "", icon: null },
        { id: "rename", label: "Rename", icon: Edit3 },
        { id: "copyKey", label: "Copy Key", icon: ClipboardCopy },
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
