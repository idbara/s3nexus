import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore } from "../../stores/toastStore";
import type { ToastVariant } from "../../stores/toastStore";
import { cn } from "../../lib/utils";

const variantStyles: Record<
  ToastVariant,
  { bg: string; icon: React.ReactNode; border: string }
> = {
  success: {
    bg: "bg-green-50 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-800",
    icon: <CheckCircle className="w-5 h-5 text-success" />,
  },
  error: {
    bg: "bg-red-50 dark:bg-red-900/30",
    border: "border-red-200 dark:border-red-800",
    icon: <XCircle className="w-5 h-5 text-danger" />,
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: <Info className="w-5 h-5 text-primary" />,
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-900/30",
    border: "border-yellow-200 dark:border-yellow-800",
    icon: <AlertTriangle className="w-5 h-5 text-warning" />,
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const style = variantStyles[toast.variant];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[320px] max-w-[420px] animate-in slide-in-from-right duration-300",
              style.bg,
              style.border
            )}
          >
            {style.icon}
            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">
              {toast.message}
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
