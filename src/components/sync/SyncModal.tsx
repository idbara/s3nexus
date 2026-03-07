import { useState } from "react";
import {
  FolderSync,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowLeftRight,
  CheckCircle,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { formatBytes } from "../../lib/utils";
import type { SyncPlan, SyncResult } from "../../types";

const DIRECTION_OPTIONS = [
  { value: "upload", label: "Upload (Local -> S3)" },
  { value: "download", label: "Download (S3 -> Local)" },
  { value: "bidirectional", label: "Bidirectional" },
];

export function SyncModal() {
  const { activeModal, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket, currentPrefix } = useExplorerStore();
  const { addToast } = useToastStore();

  const [localPath, setLocalPath] = useState("");
  const [direction, setDirection] = useState("upload");
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);

  const handlePreview = async () => {
    if (!activeProfileId || !currentBucket || !localPath.trim()) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    setPreviewing(true);
    setPlan(null);
    setResult(null);
    try {
      const syncPlan = await api.syncPreview(
        activeProfileId,
        currentBucket,
        currentPrefix,
        localPath.trim(),
        direction
      );
      setPlan(syncPlan);
    } catch (err) {
      addToast(`Sync preview failed: ${err}`, "error");
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!activeProfileId || !currentBucket || !localPath.trim()) return;

    setExecuting(true);
    setResult(null);
    try {
      const syncResult = await api.syncExecute(
        activeProfileId,
        currentBucket,
        currentPrefix,
        localPath.trim(),
        direction
      );
      setResult(syncResult);
      addToast("Sync completed", "success");
    } catch (err) {
      addToast(`Sync failed: ${err}`, "error");
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    setPlan(null);
    setResult(null);
    closeModal();
  };

  return (
    <Modal
      open={activeModal === "syncModal"}
      onClose={handleClose}
      title="Folder Sync"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="ghost"
            onClick={handlePreview}
            loading={previewing}
            disabled={!localPath.trim() || !currentBucket}
          >
            Preview Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleExecute}
            loading={executing}
            disabled={!plan || !localPath.trim() || !currentBucket}
          >
            <FolderSync className="w-4 h-4" />
            Execute Sync
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Local Folder Path"
            placeholder="C:\Users\me\Documents\sync"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
          />
          <Select
            label="Direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            options={DIRECTION_OPTIONS}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>
            Bucket: <strong className="text-gray-700 dark:text-gray-300">{currentBucket || "none"}</strong>
          </span>
          {currentPrefix && (
            <span>
              Prefix: <strong className="text-gray-700 dark:text-gray-300">{currentPrefix}</strong>
            </span>
          )}
        </div>

        {plan && !result && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sync Preview
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                Total: {formatBytes(plan.total_bytes)}
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {plan.to_upload.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <ArrowUpFromLine className="w-3 h-3" />
                    Upload ({plan.to_upload.length})
                  </div>
                  {plan.to_upload.map((action, i) => (
                    <div
                      key={i}
                      className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 flex justify-between"
                    >
                      <span className="truncate">{action.path}</span>
                      <span className="flex-shrink-0 ml-2">{formatBytes(action.size)}</span>
                    </div>
                  ))}
                </div>
              )}
              {plan.to_download.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                    <ArrowDownToLine className="w-3 h-3" />
                    Download ({plan.to_download.length})
                  </div>
                  {plan.to_download.map((action, i) => (
                    <div
                      key={i}
                      className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 flex justify-between"
                    >
                      <span className="truncate">{action.path}</span>
                      <span className="flex-shrink-0 ml-2">{formatBytes(action.size)}</span>
                    </div>
                  ))}
                </div>
              )}
              {plan.to_skip.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <ArrowLeftRight className="w-3 h-3" />
                    Skip ({plan.to_skip.length})
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-success" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sync Complete
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-blue-500">
                  {result.uploaded}
                </div>
                <div className="text-xs text-gray-500">Uploaded</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-500">
                  {result.downloaded}
                </div>
                <div className="text-xs text-gray-500">Downloaded</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-500">
                  {result.skipped}
                </div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
              <div>
                <div className="text-lg font-bold text-danger">
                  {result.failed}
                </div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-danger">
                {result.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
