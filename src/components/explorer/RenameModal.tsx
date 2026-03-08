import { useState } from "react";
import { Edit3 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { errMsg } from "../../lib/utils";
import type { ObjectInfo } from "../../types";

export function RenameModal() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket, currentPrefix, fetchObjects } = useExplorerStore();
  const { addToast } = useToastStore();

  const object = modalData.object as ObjectInfo | undefined;
  const objectKey = modalData.objectKey as string | undefined;

  const [newName, setNewName] = useState(object?.display_name || "");
  const [renaming, setRenaming] = useState(false);

  const handleRename = async () => {
    if (!activeProfileId || !currentBucket || !objectKey || !newName.trim())
      return;

    const newKey = currentPrefix + newName.trim() + (object?.is_folder ? "/" : "");

    if (newKey === objectKey) {
      closeModal();
      return;
    }

    setRenaming(true);
    try {
      await api.renameObject(
        activeProfileId,
        currentBucket,
        objectKey,
        newKey
      );
      addToast("Renamed successfully", "success");
      await fetchObjects(activeProfileId);
      closeModal();
    } catch (err) {
      addToast(`Rename failed: ${errMsg(err)}`, "error");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <Modal
      open={activeModal === "rename"}
      onClose={closeModal}
      title="Rename"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRename}
            loading={renaming}
            disabled={!newName.trim()}
          >
            <Edit3 className="w-4 h-4" />
            Rename
          </Button>
        </>
      }
    >
      <Input
        label="New Name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleRename();
        }}
        autoFocus
      />
    </Modal>
  );
}
