import { useState, useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { useProfileStore } from "../../stores/profileStore";
import { useModalStore } from "../../stores/modalStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import type { Profile } from "../../types";

const PROVIDERS = [
  { value: "aws", label: "Amazon S3" },
  { value: "minio", label: "MinIO" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "wasabi", label: "Wasabi" },
  { value: "custom", label: "Custom S3-Compatible" },
];

export function ProfileForm() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { createProfile, updateProfile } = useProfileStore();
  const { addToast } = useToastStore();

  const editProfile = modalData.profile as Profile | undefined;
  const isEdit = Boolean(editProfile);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState("aws");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [pathStyle, setPathStyle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (activeModal === "profileForm") {
      setName(editProfile?.name || "");
      setProvider(editProfile?.provider || "aws");
      setAccessKey("");
      setSecretKey("");
      setRegion(editProfile?.region || "us-east-1");
      setEndpointUrl(editProfile?.endpoint_url || "");
      setPathStyle(editProfile?.path_style || false);
      setTestResult(null);
    }
  }, [activeModal, editProfile]);

  const showEndpoint =
    provider === "minio" || provider === "custom" || provider === "r2" || provider === "wasabi";

  const handleTestConnection = async () => {
    if (!editProfile) {
      addToast("Save the profile first to test connection", "warning");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await api.testConnection(editProfile.id);
      setTestResult(ok);
      addToast(
        ok ? "Connection successful" : "Connection failed",
        ok ? "success" : "error"
      );
    } catch (err) {
      setTestResult(false);
      addToast(`Connection failed: ${err}`, "error");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast("Profile name is required", "warning");
      return;
    }
    if (!accessKey.trim() && !isEdit) {
      addToast("Access key is required", "warning");
      return;
    }
    if (!secretKey.trim() && !isEdit) {
      addToast("Secret key is required", "warning");
      return;
    }

    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        provider,
        access_key: accessKey.trim(),
        secret_key: secretKey.trim(),
        region: region.trim() || undefined,
        endpoint_url: showEndpoint ? endpointUrl.trim() || undefined : undefined,
        path_style: pathStyle,
      };

      if (isEdit && editProfile) {
        await updateProfile(editProfile.id, input);
        addToast("Profile updated", "success");
      } else {
        await createProfile(input);
        addToast("Profile created", "success");
      }
      closeModal();
    } catch (err) {
      addToast(`Failed to save profile: ${err}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={activeModal === "profileForm"}
      onClose={closeModal}
      title={isEdit ? "Edit Profile" : "New Profile"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          {isEdit && (
            <Button
              variant="ghost"
              onClick={handleTestConnection}
              loading={testing}
            >
              {testResult === true && (
                <CheckCircle className="w-4 h-4 text-success" />
              )}
              {testResult === false && (
                <XCircle className="w-4 h-4 text-danger" />
              )}
              Test Connection
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Profile Name"
          placeholder="My AWS Account"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Select
          label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          options={PROVIDERS}
        />

        <Input
          label="Access Key"
          placeholder={isEdit ? "(unchanged)" : "AKIA..."}
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
        />

        <Input
          label="Secret Key"
          variant="password"
          placeholder={isEdit ? "(unchanged)" : "Enter secret key"}
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />

        <Input
          label="Region"
          placeholder="us-east-1"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />

        {showEndpoint && (
          <Input
            label="Endpoint URL"
            placeholder="https://s3.example.com"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
          />
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pathStyle}
            onChange={(e) => setPathStyle(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Path-style access (required for MinIO)
          </span>
        </label>
      </div>
    </Modal>
  );
}
