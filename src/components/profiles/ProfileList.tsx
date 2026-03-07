import { Cloud, Server, Globe, Trash2, Edit2, Plus } from "lucide-react";
import { useProfileStore } from "../../stores/profileStore";
import { useModalStore } from "../../stores/modalStore";
import { useToastStore } from "../../stores/toastStore";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { Profile } from "../../types";

function getProviderIcon(provider: string) {
  switch (provider.toLowerCase()) {
    case "aws":
      return <Cloud className="w-4 h-4 text-orange-500" />;
    case "minio":
      return <Server className="w-4 h-4 text-red-500" />;
    case "r2":
      return <Globe className="w-4 h-4 text-yellow-500" />;
    case "wasabi":
      return <Cloud className="w-4 h-4 text-green-500" />;
    default:
      return <Server className="w-4 h-4 text-gray-500" />;
  }
}

export function ProfileList() {
  const { profiles, activeProfileId, setActiveProfile, deleteProfile } =
    useProfileStore();
  const { activeModal, openModal, closeModal } = useModalStore();
  const { addToast } = useToastStore();

  const handleDelete = async (profile: Profile, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete profile "${profile.name}"?`)) return;
    try {
      await deleteProfile(profile.id);
      addToast("Profile deleted", "success");
    } catch (err) {
      addToast(`Failed to delete: ${err}`, "error");
    }
  };

  const handleEdit = (profile: Profile, e: React.MouseEvent) => {
    e.stopPropagation();
    openModal("profileForm", { profile });
  };

  return (
    <Modal
      open={activeModal === "profileList"}
      onClose={closeModal}
      title="Manage Profiles"
      size="lg"
      footer={
        <Button
          variant="primary"
          onClick={() => openModal("profileForm")}
        >
          <Plus className="w-4 h-4" />
          Add Profile
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        {profiles.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            No profiles yet. Create one to get started.
          </div>
        )}
        {profiles.map((profile) => (
          <div
            key={profile.id}
            onClick={() => {
              setActiveProfile(profile.id);
              closeModal();
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group transition-colors",
              activeProfileId === profile.id
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent"
            )}
          >
            {getProviderIcon(profile.provider)}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {profile.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {profile.provider} - {profile.region}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleEdit(profile, e)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => handleDelete(profile, e)}
                className="p-1 rounded text-gray-400 hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
