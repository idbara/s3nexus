import { useState, useEffect } from "react";
import {
  FolderSync,
  FolderOpen,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowLeftRight,
  CheckCircle,
  Cloud,
  HardDrive,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { formatBytes, errMsg } from "../../lib/utils";
import type { SyncPlan, SyncResult, BucketInfo } from "../../types";

const DIRECTION_OPTIONS = [
  { value: "upload", label: "Upload (Local \u2192 S3)" },
  { value: "download", label: "Download (S3 \u2192 Local)" },
  { value: "bidirectional", label: "Bidirectional" },
];

export function SyncModal() {
  const { activeModal, closeModal } = useModalStore();
  const { activeProfileId, profiles } = useProfileStore();
  const { currentBucket, currentPrefix, buckets } = useExplorerStore();
  const { addToast } = useToastStore();

  const [localPath, setLocalPath] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedBucket, setSelectedBucket] = useState("");
  const [prefix, setPrefix] = useState("");
  const [direction, setDirection] = useState("upload");
  const [plan, setPlan] = useState<SyncPlan | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [loadedBuckets, setLoadedBuckets] = useState<BucketInfo[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);

  // Initialize from explorer state when modal opens
  useEffect(() => {
    if (activeModal === "syncModal") {
      setSelectedProfileId(activeProfileId || "");
      setSelectedBucket(currentBucket || "");
      setPrefix(currentPrefix || "");
      if (buckets.length > 0) {
        setLoadedBuckets(buckets);
      } else if (activeProfileId) {
        setLoadingBuckets(true);
        api.listBuckets(activeProfileId).then(setLoadedBuckets).catch(() => {}).finally(() => setLoadingBuckets(false));
      }
    }
  }, [activeModal, currentBucket, currentPrefix, buckets, activeProfileId]);

  // Reload buckets when profile changes
  useEffect(() => {
    if (!selectedProfileId || activeModal !== "syncModal") return;
    // If same as active profile and we already have buckets from explorer, reuse
    if (selectedProfileId === activeProfileId && buckets.length > 0) {
      setLoadedBuckets(buckets);
      return;
    }
    setLoadedBuckets([]);
    setSelectedBucket("");
    setLoadingBuckets(true);
    api.listBuckets(selectedProfileId).then(setLoadedBuckets).catch(() => {}).finally(() => setLoadingBuckets(false));
  }, [selectedProfileId]);

  const profileOptions = profiles.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.provider})`,
  }));

  const bucketOptions = loadedBuckets.map((b) => ({
    value: b.name,
    label: b.name,
  }));

  const handleBrowseFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Local Folder",
    });
    if (selected) setLocalPath(selected as string);
  };

  const handlePreview = async () => {
    if (!selectedProfileId || !selectedBucket || !localPath.trim()) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    setPreviewing(true);
    setPlan(null);
    setResult(null);
    try {
      const syncPlan = await api.syncPreview(
        selectedProfileId,
        selectedBucket,
        prefix,
        localPath.trim(),
        direction
      );
      setPlan(syncPlan);
    } catch (err) {
      addToast(`Sync preview failed: ${errMsg(err)}`, "error");
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedProfileId || !selectedBucket || !localPath.trim()) return;

    setExecuting(true);
    setResult(null);
    try {
      const syncResult = await api.syncExecute(
        selectedProfileId,
        selectedBucket,
        prefix,
        localPath.trim(),
        direction
      );
      setResult(syncResult);
      addToast("Sync completed", "success");
    } catch (err) {
      addToast(`Sync failed: ${errMsg(err)}`, "error");
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    setPlan(null);
    setResult(null);
    closeModal();
  };

  const isReady = localPath.trim() && selectedProfileId && selectedBucket;

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
            disabled={!isReady}
          >
            Preview Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleExecute}
            loading={executing}
            disabled={!plan || !isReady}
          >
            <FolderSync className="w-4 h-4" />
            Execute Sync
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Local Source */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <HardDrive className="w-4 h-4" />
            Local
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Select a local folder..."
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleBrowseFolder}
              title="Browse folder"
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Direction */}
        <Select
          label="Sync Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          options={DIRECTION_OPTIONS}
        />

        {/* S3 Destination */}
        <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Cloud className="w-4 h-4" />
            S3 Destination
          </div>
          <Select
            label="Profile"
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            options={[
              { value: "", label: "-- Select Profile --" },
              ...profileOptions,
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Bucket"
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              options={[
                { value: "", label: loadingBuckets ? "Loading buckets..." : "-- Select Bucket --" },
                ...bucketOptions,
              ]}
              disabled={!selectedProfileId || loadingBuckets}
            />
            <Input
              label="Prefix (optional)"
              placeholder="e.g. backups/photos/"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </div>
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
