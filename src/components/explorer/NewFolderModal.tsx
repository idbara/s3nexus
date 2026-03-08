import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { errMsg } from "../../lib/utils";

export function NewFolderModal() {
  const { activeModal, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket, currentPrefix, fetchObjects } = useExplorerStore();
  const { addToast } = useToastStore();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!activeProfileId || !currentBucket || !name.trim()) return;

    setCreating(true);
    try {
      const folderPath = currentPrefix + name.trim() + "/";
      await api.createFolder(activeProfileId, currentBucket, folderPath);
      addToast(`Folder "${name.trim()}" created`, "success");
      await fetchObjects(activeProfileId);
      setName("");
      closeModal();
    } catch (err) {
      addToast(`Failed to create folder: ${errMsg(err)}`, "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={activeModal === "newFolder"}
      onClose={closeModal}
      title="New Folder"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={creating}
            disabled={!name.trim()}
          >
            <FolderPlus className="w-4 h-4" />
            Create
          </Button>
        </>
      }
    >
      <Input
        label="Folder Name"
        placeholder="new-folder"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
        }}
        autoFocus
      />
    </Modal>
  );
}
