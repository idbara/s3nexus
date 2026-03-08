import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Database, ExternalLink } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useModalStore } from "../../stores/modalStore";

export function AboutModal() {
  const { activeModal, closeModal } = useModalStore();
  const [version, setVersion] = useState("");

  useEffect(() => {
    if (activeModal === "about") {
      getVersion().then(setVersion).catch(() => setVersion("unknown"));
    }
  }, [activeModal]);

  return (
    <Modal
      open={activeModal === "about"}
      onClose={closeModal}
      title="About S3 Nexus"
      size="sm"
      footer={
        <Button variant="secondary" onClick={closeModal}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Database className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            S3 Nexus
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            v{version}
          </p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300">
          A cross-platform S3 browser and file manager for AWS S3, MinIO,
          Cloudflare R2, DigitalOcean Spaces, and other S3-compatible providers.
        </p>

        <div className="w-full text-left text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Built with:
            </span>{" "}
            Tauri v2, React 19, Rust, Tailwind CSS
          </p>
          <p>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              License:
            </span>{" "}
            MIT
          </p>
        </div>

        <a
          href="https://github.com/idbara/s3nexus"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          GitHub Repository
        </a>
      </div>
    </Modal>
  );
}
