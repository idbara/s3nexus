export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatSpeed(bps: number): string {
  if (bps === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const k = 1024;
  const i = Math.floor(Math.log(bps) / Math.log(k));
  const value = bps / Math.pow(k, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) return "";
  return name.slice(lastDot + 1).toLowerCase();
}

export function getFileIcon(name: string, isFolder: boolean): string {
  if (isFolder) return "Folder";

  const ext = getFileExtension(name);

  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico", "tiff"];
  const textExts = ["txt", "log", "csv", "tsv", "ini", "cfg"];
  const codeExts = [
    "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp",
    "h", "hpp", "cs", "php", "html", "css", "scss", "less", "vue", "svelte",
    "json", "xml", "yaml", "yml", "toml", "sh", "bash", "sql", "graphql",
  ];
  const archiveExts = ["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "tgz"];
  const videoExts = ["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "wma", "m4a"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt"];

  if (imageExts.includes(ext)) return "FileImage";
  if (textExts.includes(ext)) return "FileText";
  if (codeExts.includes(ext)) return "FileCode";
  if (archiveExts.includes(ext)) return "FileArchive";
  if (videoExts.includes(ext)) return "FileVideo";
  if (audioExts.includes(ext)) return "FileAudio";
  if (docExts.includes(ext)) return "FileText";
  if (ext === "md" || ext === "markdown") return "FileText";

  return "File";
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function errMsg(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return (err as { message: string }).message;
  }
  return String(err);
}
