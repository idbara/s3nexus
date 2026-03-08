import { useState } from "react";
import { Link, Copy, CheckCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { errMsg } from "../../lib/utils";

const EXPIRY_OPTIONS = [
  { value: "900", label: "15 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
  { value: "custom", label: "Custom" },
];

const OPERATION_OPTIONS = [
  { value: "GET", label: "Download (GET)" },
  { value: "PUT", label: "Upload (PUT)" },
];

export function PresignedModal() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();

  const objectKey = modalData.objectKey as string | undefined;

  const [expiryOption, setExpiryOption] = useState("3600");
  const [customExpiry, setCustomExpiry] = useState("3600");
  const [operation, setOperation] = useState("GET");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!activeProfileId || !currentBucket || !objectKey) return;

    const expirySeconds =
      expiryOption === "custom"
        ? parseInt(customExpiry, 10)
        : parseInt(expiryOption, 10);

    if (isNaN(expirySeconds) || expirySeconds <= 0) {
      addToast("Invalid expiry time", "warning");
      return;
    }

    setLoading(true);
    try {
      const result = await api.generatePresignedUrl(
        activeProfileId,
        currentBucket,
        objectKey,
        expirySeconds,
        operation
      );
      setGeneratedUrl(result.url);
    } catch (err) {
      addToast(`Failed to generate URL: ${errMsg(err)}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    addToast("URL copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedUrl("");
    setCopied(false);
    closeModal();
  };

  return (
    <Modal
      open={activeModal === "presignedUrl"}
      onClose={handleClose}
      title="Generate Presigned URL"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            loading={loading}
          >
            <Link className="w-4 h-4" />
            Generate
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Object Key
          </label>
          <div className="mt-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono break-all">
            {objectKey}
          </div>
        </div>

        <Select
          label="Operation"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
          options={OPERATION_OPTIONS}
        />

        <Select
          label="Expiry"
          value={expiryOption}
          onChange={(e) => setExpiryOption(e.target.value)}
          options={EXPIRY_OPTIONS}
        />

        {expiryOption === "custom" && (
          <Input
            label="Custom Expiry (seconds)"
            variant="number"
            value={customExpiry}
            onChange={(e) => setCustomExpiry(e.target.value)}
            placeholder="3600"
          />
        )}

        {generatedUrl && (
          <div className="mt-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Generated URL
            </label>
            <div className="mt-1 flex gap-2">
              <div className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-mono break-all max-h-32 overflow-y-auto">
                {generatedUrl}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
