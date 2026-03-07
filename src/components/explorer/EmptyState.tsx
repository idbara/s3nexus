import { FolderOpen, Upload, Database } from "lucide-react";
import { Button } from "../ui/Button";

interface EmptyStateProps {
  hasBucket: boolean;
  onUpload?: () => void;
}

export function EmptyState({ hasBucket, onUpload }: EmptyStateProps) {
  if (!hasBucket) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Database className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            No bucket selected
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select a bucket from the sidebar to browse its contents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <FolderOpen className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          This folder is empty
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upload files or create a new folder to get started
        </p>
      </div>
      {onUpload && (
        <Button variant="primary" size="md" onClick={onUpload}>
          <Upload className="w-4 h-4" />
          Upload Files
        </Button>
      )}
    </div>
  );
}
