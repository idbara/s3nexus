import { useState, useEffect } from "react";
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "../ui/Modal";
import { useModalStore } from "../../stores/modalStore";
import { useProfileStore } from "../../stores/profileStore";
import { useExplorerStore } from "../../stores/explorerStore";
import { useToastStore } from "../../stores/toastStore";
import { api } from "../../lib/tauri";
import { formatBytes, getFileExtension } from "../../lib/utils";
import type { PreviewResult } from "../../types";

export function PreviewPanel() {
  const { activeModal, modalData, closeModal } = useModalStore();
  const { activeProfileId } = useProfileStore();
  const { currentBucket } = useExplorerStore();
  const { addToast } = useToastStore();

  const objectKey = modalData.objectKey as string | undefined;
  const object = modalData.object as { display_name: string; size: number } | undefined;

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeModal === "preview" && activeProfileId && currentBucket && objectKey) {
      setLoading(true);
      setPreview(null);
      api
        .previewObject(activeProfileId, currentBucket, objectKey)
        .then((result) => {
          setPreview(result);
        })
        .catch((err) => {
          addToast(`Failed to load preview: ${err}`, "error");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [activeModal, activeProfileId, currentBucket, objectKey, addToast]);

  const isMarkdown = objectKey
    ? ["md", "markdown"].includes(getFileExtension(objectKey))
    : false;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
          <AlertCircle className="w-10 h-10" />
          <span className="text-sm">Unable to load preview</span>
        </div>
      );
    }

    switch (preview.data.type) {
      case "Text":
        if (isMarkdown) {
          return (
            <div className="prose prose-sm dark:prose-invert max-w-none px-4 py-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {preview.data.content}
              </ReactMarkdown>
            </div>
          );
        }
        return (
          <div className="overflow-auto">
            <pre className="px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {preview.data.content.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="inline-block w-10 text-right pr-3 text-gray-400 dark:text-gray-600 select-none flex-shrink-0 text-xs leading-relaxed">
                    {i + 1}
                  </span>
                  <span className="flex-1">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        );

      case "Image":
        return (
          <div className="flex items-center justify-center p-4 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
            <img
              src={`data:${preview.content_type};base64,${preview.data.content}`}
              alt={object?.display_name || "Preview"}
              className="max-w-full max-h-[50vh] object-contain rounded"
            />
          </div>
        );

      case "Unsupported":
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
            <FileText className="w-12 h-12" />
            <span className="text-sm">Preview not available</span>
            <span className="text-xs text-gray-400">
              Content type: {preview.content_type}
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={activeModal === "preview"}
      onClose={closeModal}
      title={object?.display_name || "Preview"}
      size="xl"
    >
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-4 px-1 pb-3 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {object && <span>Size: {formatBytes(object.size)}</span>}
          {preview && <span>Type: {preview.content_type}</span>}
        </div>
        <div className="mt-2 -mx-6 -mb-4 border-t border-gray-200 dark:border-gray-700">
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
}
