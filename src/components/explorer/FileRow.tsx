import {
  Folder,
  File,
  FileImage,
  FileText,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
} from "lucide-react";
import type { ObjectInfo } from "../../types";
import { formatBytes, formatDate, getFileIcon, cn } from "../../lib/utils";

const iconMap: Record<string, React.ElementType> = {
  Folder,
  File,
  FileImage,
  FileText,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
};

interface FileRowProps {
  object: ObjectInfo;
  selected: boolean;
  onSelect: (key: string) => void;
  onClick: (object: ObjectInfo) => void;
  onDoubleClick: (object: ObjectInfo) => void;
  onContextMenu: (e: React.MouseEvent, object: ObjectInfo) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, object: ObjectInfo) => void;
}

export function FileRow({
  object,
  selected,
  onSelect,
  onClick,
  onDoubleClick,
  onContextMenu,
  draggable,
  onDragStart,
}: FileRowProps) {
  const iconName = getFileIcon(object.display_name, object.is_folder);
  const IconComponent = iconMap[iconName] || File;

  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800",
        selected
          ? "bg-primary/5 dark:bg-primary/10"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
      draggable={draggable}
      onDragStart={onDragStart ? (e) => onDragStart(e, object) : undefined}
      onClick={() => onClick(object)}
      onDoubleClick={() => onDoubleClick(object)}
      onContextMenu={(e) => onContextMenu(e, object)}
    >
      <td className="w-10 px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(object.key);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary cursor-pointer"
        />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2.5">
          <IconComponent
            className={cn(
              "w-4 h-4 flex-shrink-0",
              object.is_folder
                ? "text-blue-500"
                : "text-gray-400 dark:text-gray-500"
            )}
          />
          <span
            className={cn(
              "text-sm truncate",
              object.is_folder
                ? "font-medium text-gray-900 dark:text-gray-100"
                : "text-gray-700 dark:text-gray-300"
            )}
          >
            {object.display_name}
          </span>
        </div>
      </td>
      <td className="py-2 pr-3 text-right">
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          {object.is_folder ? "--" : formatBytes(object.size)}
        </span>
      </td>
      <td className="py-2 pr-3 text-right">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {object.last_modified ? formatDate(object.last_modified) : "--"}
        </span>
      </td>
    </tr>
  );
}
