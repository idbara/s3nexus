import { useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";

export function MonitorSetupModal() {
  const { activeModal, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { buckets, currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();

  const [localPath, setLocalPath] = useState("");
  const [bucket, setBucket] = useState(currentBucket || "");
  const [prefix, setPrefix] = useState("");
  const [deleteOnRemote, setDeleteOnRemote] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!activeProfileId || !bucket || !localPath.trim()) {
      addToast("Fill in all required fields", "warning");
      return;
    }

    setCreating(true);
    try {
      await api.createMonitor(
        activeProfileId,
        bucket,
        prefix,
        localPath.trim(),
        deleteOnRemote
      );
      addToast("Monitor created successfully", "success");
      closeModal();
    } catch (err) {
      addToast(`Failed to create monitor: ${err}`, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={activeModal === "monitorSetup"}
      onClose={closeModal}
      title="Setup Folder Monitor"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={creating}
            disabled={!localPath.trim() || !bucket}
          >
            <Eye className="w-4 h-4" />
            Create Monitor
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Local Folder Path"
          placeholder="C:\Users\me\Documents\watched"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
        />

        <Select
          label="Bucket"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          options={[
            { value: "", label: "Select a bucket" },
            ...buckets.map((b) => ({ value: b.name, label: b.name })),
          ]}
        />

        <Input
          label="Prefix (optional)"
          placeholder="uploads/"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteOnRemote}
            onChange={(e) => setDeleteOnRemote(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Delete on remote when local file is deleted
          </span>
        </label>
      </div>
    </Modal>
  );
}
