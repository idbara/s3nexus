import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Trash2, Code } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { useThemeStore } from "../../stores/themeStore";
import { api } from "../../lib/tauri";

export function PolicyEditorModal() {
  const { activeModal, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();
  const { resolved } = useThemeStore();

  const [policyJson, setPolicyJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    if (activeModal === "policyEditor" && activeProfileId && currentBucket) {
      api
        .getBucketPolicy(activeProfileId, currentBucket)
        .then((result) => {
          if (result) {
            try {
              const formatted = JSON.stringify(JSON.parse(result), null, 2);
              setPolicyJson(formatted);
            } catch {
              setPolicyJson(result);
            }
          } else {
            setPolicyJson("");
          }
        })
        .catch((err) => {
          addToast(`Failed to load policy: ${err}`, "error");
          setPolicyJson("");
        });
    }
  }, [activeModal, activeProfileId, currentBucket, addToast]);

  const handleChange = (value: string) => {
    setPolicyJson(value);
    if (value.trim() === "") {
      setIsValid(true);
      return;
    }
    try {
      JSON.parse(value);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  const handleFormat = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(policyJson), null, 2);
      setPolicyJson(formatted);
      setIsValid(true);
    } catch {
      addToast("Cannot format invalid JSON", "warning");
    }
  };

  const handleApply = async () => {
    if (!activeProfileId || !currentBucket) return;
    if (!policyJson.trim()) {
      addToast("Policy is empty. Use Delete Policy to remove it.", "warning");
      return;
    }
    if (!isValid) {
      addToast("Fix JSON errors before applying", "warning");
      return;
    }

    setSaving(true);
    try {
      await api.setBucketPolicy(activeProfileId, currentBucket, policyJson);
      addToast("Bucket policy updated", "success");
    } catch (err) {
      addToast(`Failed to set policy: ${err}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeProfileId || !currentBucket) return;
    if (!confirm("Are you sure you want to delete the bucket policy?")) return;

    setSaving(true);
    try {
      await api.deleteBucketPolicy(activeProfileId, currentBucket);
      setPolicyJson("");
      addToast("Bucket policy deleted", "success");
    } catch (err) {
      addToast(`Failed to delete policy: ${err}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={activeModal === "policyEditor"}
      onClose={closeModal}
      title={`Bucket Policy - ${currentBucket}`}
      size="xl"
      footer={
        <>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={!policyJson.trim()}
          >
            <Trash2 className="w-4 h-4" />
            Delete Policy
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={handleFormat}>
            <Code className="w-4 h-4" />
            Format
          </Button>
          <Button
            variant="primary"
            onClick={handleApply}
            loading={saving}
            disabled={!isValid || !policyJson.trim()}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="w-3.5 h-3.5" />
              Valid JSON
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-danger">
              <AlertCircle className="w-3.5 h-3.5" />
              Invalid JSON
            </span>
          )}
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <CodeMirror
            value={policyJson}
            height="300px"
            extensions={[json()]}
            theme={resolved === "dark" ? "dark" : "light"}
            onChange={handleChange}
            placeholder='{\n  "Version": "2012-10-17",\n  "Statement": []\n}'
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLineGutter: true,
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
