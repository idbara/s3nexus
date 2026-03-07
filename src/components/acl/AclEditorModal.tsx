import { useState, useEffect } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import type { ObjectAcl } from "../../types";
import { cn } from "../../lib/utils";

const ACL_PRESETS = [
  { value: "private", label: "Private", desc: "Owner only" },
  {
    value: "public-read",
    label: "Public Read",
    desc: "Anyone can read",
  },
  {
    value: "public-read-write",
    label: "Public Read-Write",
    desc: "Anyone can read and write",
  },
  {
    value: "authenticated-read",
    label: "Authenticated Read",
    desc: "Authenticated users can read",
  },
];

export function AclEditorModal() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();

  const objectKey = modalData.objectKey as string | undefined;

  const [acl, setAcl] = useState<ObjectAcl | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    if (activeModal === "aclEditor" && activeProfileId && currentBucket && objectKey) {
      setLoading(true);
      api
        .getObjectAcl(activeProfileId, currentBucket, objectKey)
        .then((result) => {
          setAcl(result);
        })
        .catch((err) => {
          addToast(`Failed to load ACL: ${err}`, "error");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [activeModal, activeProfileId, currentBucket, objectKey, addToast]);

  const handleApply = async () => {
    if (!activeProfileId || !currentBucket || !objectKey || !selectedPreset) return;

    setApplying(true);
    try {
      await api.setObjectAcl(
        activeProfileId,
        currentBucket,
        objectKey,
        selectedPreset
      );
      addToast("ACL updated successfully", "success");
      const updated = await api.getObjectAcl(
        activeProfileId,
        currentBucket,
        objectKey
      );
      setAcl(updated);
      setSelectedPreset(null);
    } catch (err) {
      addToast(`Failed to update ACL: ${err}`, "error");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      open={activeModal === "aclEditor"}
      onClose={closeModal}
      title="Object Permissions"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={!selectedPreset}
            loading={applying}
          >
            <Shield className="w-4 h-4" />
            Apply
          </Button>
        </>
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

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Quick Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ACL_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setSelectedPreset(preset.value)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-colors",
                  selectedPreset === preset.value
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {preset.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Current Grants
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : acl ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {acl.owner && (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Owner: {acl.owner}
                </div>
              )}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Grantee
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Permission
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {acl.grants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-4 text-sm text-gray-400 dark:text-gray-500 text-center"
                      >
                        No grants found
                      </td>
                    </tr>
                  ) : (
                    acl.grants.map((grant, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                          {grant.grantee}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {grant.grantee_type}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          {grant.permission}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              Unable to load ACL data
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
