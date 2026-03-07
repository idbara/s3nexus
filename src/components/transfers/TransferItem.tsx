import {
  Pause,
  Play,
  X,
  Upload,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import type { TransferTask } from "../../types";
import { formatBytes, formatSpeed, formatEta, cn } from "../../lib/utils";

interface TransferItemProps {
  transfer: TransferTask;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

const statusConfig: Record<
  string,
  { color: string; bgColor: string; icon: React.ElementType; label: string }
> = {
  queued: {
    color: "text-gray-500",
    bgColor: "bg-gray-500",
    icon: Clock,
    label: "Queued",
  },
  in_progress: {
    color: "text-blue-500",
    bgColor: "bg-blue-500",
    icon: Loader2,
    label: "Transferring",
  },
  paused: {
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    icon: Pause,
    label: "Paused",
  },
  completed: {
    color: "text-green-500",
    bgColor: "bg-green-500",
    icon: CheckCircle,
    label: "Completed",
  },
  failed: {
    color: "text-red-500",
    bgColor: "bg-red-500",
    icon: XCircle,
    label: "Failed",
  },
  cancelled: {
    color: "text-gray-400",
    bgColor: "bg-gray-400",
    icon: AlertCircle,
    label: "Cancelled",
  },
};

export function TransferItem({
  transfer,
  onPause,
  onResume,
  onCancel,
}: TransferItemProps) {
  const config = statusConfig[transfer.status] || statusConfig.queued;
  const StatusIcon = config.icon;
  const progress =
    transfer.file_size > 0
      ? Math.round((transfer.bytes_transferred / transfer.file_size) * 100)
      : 0;
  const isActive =
    transfer.status === "in_progress" || transfer.status === "queued";
  const isPaused = transfer.status === "paused";

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
      <div className={cn("flex-shrink-0", config.color)}>
        {transfer.transfer_type === "upload" ? (
          <Upload className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
            {transfer.file_name}
          </span>
          <StatusIcon
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              config.color,
              transfer.status === "in_progress" && "animate-spin"
            )}
          />
        </div>

        {(isActive || isPaused) && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  config.bgColor
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
              {progress}%
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          <span>
            {formatBytes(transfer.bytes_transferred)} /{" "}
            {formatBytes(transfer.file_size)}
          </span>
          {transfer.status === "in_progress" && transfer.speed_bps > 0 && (
            <>
              <span>{formatSpeed(transfer.speed_bps)}</span>
              {transfer.eta_seconds !== null && (
                <span>ETA: {formatEta(transfer.eta_seconds)}</span>
              )}
            </>
          )}
          {transfer.status === "failed" && transfer.error && (
            <span className="text-danger truncate">{transfer.error}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isActive && (
          <button
            onClick={() => onPause(transfer.id)}
            className="p-1 rounded text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
            title="Pause"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
        {isPaused && (
          <button
            onClick={() => onResume(transfer.id)}
            className="p-1 rounded text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            title="Resume"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
        {(isActive || isPaused) && (
          <button
            onClick={() => onCancel(transfer.id)}
            className="p-1 rounded text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
