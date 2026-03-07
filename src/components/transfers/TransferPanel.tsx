import { useEffect } from "react";
import { ChevronUp, ChevronDown, Trash2, ArrowUpDown } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useTransferStore } from "../../stores/transferStore";
import { TransferItem } from "./TransferItem";
import type { TransferProgressEvent } from "../../types";
import { cn } from "../../lib/utils";

export function TransferPanel() {
  const {
    transfers,
    isPanelOpen,
    fetchTransfers,
    updateTransferProgress,
    togglePanel,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    clearCompleted,
  } = useTransferStore();

  useEffect(() => {
    fetchTransfers();

    let unlisten: (() => void) | undefined;
    listen<TransferProgressEvent>("transfer-progress", (event) => {
      updateTransferProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchTransfers, updateTransferProgress]);

  const activeCount = transfers.filter(
    (t) =>
      t.status === "in_progress" ||
      t.status === "queued" ||
      t.status === "paused"
  ).length;

  const completedCount = transfers.filter(
    (t) =>
      t.status === "completed" ||
      t.status === "failed" ||
      t.status === "cancelled"
  ).length;

  return (
    <div
      className={cn(
        "border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1e2e] transition-all duration-300",
        isPanelOpen ? "h-64" : "h-9"
      )}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={togglePanel}
      >
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Transfers
            {activeCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-primary rounded-full">
                {activeCount}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {completedCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
          {isPanelOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {isPanelOpen && (
        <div className="overflow-y-auto h-[calc(100%-36px)]">
          {transfers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">
              No transfers
            </div>
          ) : (
            transfers.map((transfer) => (
              <TransferItem
                key={transfer.id}
                transfer={transfer}
                onPause={pauseTransfer}
                onResume={resumeTransfer}
                onCancel={cancelTransfer}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
