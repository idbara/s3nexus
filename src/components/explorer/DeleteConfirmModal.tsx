import { Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import type { ObjectInfo } from "../../types";

export function DeleteConfirmModal() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket, fetchObjects, clearSelection } = useExplorerStore();
  const { addToast } = useToastStore();

  const objectKey = modalData.objectKey as string | undefined;
  const object = modalData.object as ObjectInfo | undefined;

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!activeProfileId || !currentBucket || !objectKey) return;

    setDeleting(true);
    try {
      await api.deleteObjects(activeProfileId, currentBucket, [objectKey]);
      clearSelection();
      addToast(`Deleted: ${object?.display_name || objectKey}`, "success");
      await fetchObjects(activeProfileId);
      closeModal();
    } catch (err) {
      addToast(`Delete failed: ${err}`, "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={activeModal === "deleteConfirm"}
      onClose={closeModal}
      title="Confirm Delete"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-danger" />
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Are you sure you want to delete{" "}
          <strong className="font-medium">
            {object?.display_name || objectKey}
          </strong>
          ?
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This action cannot be undone.
        </p>
      </div>
    </Modal>
  );
}
