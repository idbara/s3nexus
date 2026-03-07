import { useState, useEffect } from "react";
import {
  RotateCcw,
  Trash2,
  Loader2,
  Tag,
  AlertCircle,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { formatBytes, formatDate } from "../../lib/utils";
import type { ObjectVersion } from "../../types";

export function VersionHistoryModal() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();

  const objectKey = modalData.objectKey as string | undefined;

  const [versions, setVersions] = useState<ObjectVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (
      activeModal === "versionHistory" &&
      activeProfileId &&
      currentBucket &&
      objectKey
    ) {
      setLoading(true);
      api
        .listObjectVersions(activeProfileId, currentBucket, objectKey)
        .then((result) => {
          setVersions(result);
        })
        .catch((err) => {
          addToast(`Failed to load versions: ${err}`, "error");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [activeModal, activeProfileId, currentBucket, objectKey, addToast]);

  const handleRestore = async (versionId: string) => {
    if (!activeProfileId || !currentBucket || !objectKey) return;
    if (!confirm(`Restore version ${versionId}? This will overwrite the current version.`))
      return;

    setRestoring(versionId);
    try {
      await api.restoreObjectVersion(
        activeProfileId,
        currentBucket,
        objectKey,
        versionId
      );
      addToast("Version restored successfully", "success");
      const updated = await api.listObjectVersions(
        activeProfileId,
        currentBucket,
        objectKey
      );
      setVersions(updated);
    } catch (err) {
      addToast(`Failed to restore version: ${err}`, "error");
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Modal
      open={activeModal === "versionHistory"}
      onClose={closeModal}
      title="Version History"
      size="xl"
      footer={
        <Button variant="secondary" onClick={closeModal}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Object
          </label>
          <div className="mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono break-all">
            {objectKey}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-gray-500">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm">No versions found</span>
            <span className="text-xs">
              Versioning may not be enabled for this bucket
            </span>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Size
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr
                    key={version.version_id}
                    className="border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-mono truncate max-w-[140px]">
                      {version.version_id}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(version.last_modified)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-right tabular-nums">
                      {version.is_delete_marker
                        ? "--"
                        : formatBytes(version.size)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {version.is_latest && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                            <Tag className="w-3 h-3" />
                            Latest
                          </span>
                        )}
                        {version.is_delete_marker && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/20 text-danger rounded-full">
                            <Trash2 className="w-3 h-3" />
                            Deleted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!version.is_latest && !version.is_delete_marker && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestore(version.version_id)}
                          loading={restoring === version.version_id}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
