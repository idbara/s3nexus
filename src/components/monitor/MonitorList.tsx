import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Loader2,
  Folder,
  Cloud,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { formatDate, cn } from "../../lib/utils";
import type { MonitorConfig } from "../../types";

export function MonitorList() {
  const { activeModal, openModal } = useModalStore();
  const { addToast } = useToastStore();

  const [monitors, setMonitors] = useState<MonitorConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMonitors = async () => {
    setLoading(true);
    try {
      const list = await api.listMonitors();
      setMonitors(list);
    } catch (err) {
      addToast(`Failed to load monitors: ${err}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeModal === "settings") {
      fetchMonitors();
    }
  }, [activeModal]);

  const handleStop = async (id: string) => {
    try {
      await api.stopMonitor(id);
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, active: false } : m))
      );
      addToast("Monitor stopped", "success");
    } catch (err) {
      addToast(`Failed to stop monitor: ${err}`, "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this monitor?")) return;
    try {
      await api.deleteMonitor(id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      addToast("Monitor deleted", "success");
    } catch (err) {
      addToast(`Failed to delete monitor: ${err}`, "error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Folder Monitors
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openModal("monitorSetup")}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Monitor
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : monitors.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          No monitors configured
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div
                className={cn(
                  "mt-0.5",
                  monitor.active ? "text-success" : "text-gray-400"
                )}
              >
                {monitor.active ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <Folder className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300 truncate">
                    {monitor.local_path}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1">
                  <Cloud className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 truncate">
                    {monitor.bucket}
                    {monitor.prefix ? `/${monitor.prefix}` : ""}
                  </span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {monitor.active ? "Active" : "Stopped"} - Created{" "}
                  {formatDate(monitor.created_at)}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {monitor.active && (
                  <button
                    onClick={() => handleStop(monitor.id)}
                    className="p-1.5 rounded text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                    title="Stop monitor"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(monitor.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete monitor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
