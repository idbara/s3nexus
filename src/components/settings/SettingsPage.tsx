import { useState, useEffect } from "react";
import { Settings, ArrowUpDown, Globe } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useModalStore } from "../../stores/modalStore";
import { useThemeStore } from "../../stores/themeStore";
import { useToastStore } from "../../stores/toastStore";
import { MonitorList } from "../monitor/MonitorList";
import { api } from "../../lib/tauri";
import { cn } from "../../lib/utils";

const TABS = [
  { id: "general", label: "General", icon: Settings },
  { id: "transfer", label: "Transfer", icon: ArrowUpDown },
  { id: "monitors", label: "Monitors", icon: Settings },
  { id: "proxy", label: "Proxy", icon: Globe },
];

const BANDWIDTH_OPTIONS = [
  { value: "0", label: "Off (Unlimited)" },
  { value: "1048576", label: "1 MB/s" },
  { value: "5242880", label: "5 MB/s" },
  { value: "10485760", label: "10 MB/s" },
  { value: "52428800", label: "50 MB/s" },
  { value: "custom", label: "Custom" },
];

const PROXY_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "http", label: "HTTP" },
  { value: "socks5", label: "SOCKS5" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function SettingsPage() {
  const { activeModal, closeModal } = useModalStore();
  const { theme, setTheme } = useThemeStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState("general");

  // Transfer settings
  const [bandwidthOption, setBandwidthOption] = useState("0");
  const [customBandwidth, setCustomBandwidth] = useState("");

  // Proxy settings
  const [proxyType, setProxyType] = useState("none");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");

  useEffect(() => {
    if (activeModal === "settings") {
      api
        .getBandwidthLimit()
        .then((limit) => {
          const matched = BANDWIDTH_OPTIONS.find((o) => o.value === String(limit));
          if (matched) {
            setBandwidthOption(String(limit));
          } else if (limit > 0) {
            setBandwidthOption("custom");
            setCustomBandwidth(String(limit));
          } else {
            setBandwidthOption("0");
          }
        })
        .catch(() => {});

      api.getSetting("proxy_type").then((v) => v && setProxyType(v)).catch(() => {});
      api.getSetting("proxy_host").then((v) => v && setProxyHost(v)).catch(() => {});
      api.getSetting("proxy_port").then((v) => v && setProxyPort(v)).catch(() => {});
      api.getSetting("proxy_username").then((v) => v && setProxyUsername(v)).catch(() => {});
    }
  }, [activeModal]);

  const handleSaveBandwidth = async () => {
    const limit =
      bandwidthOption === "custom"
        ? parseInt(customBandwidth, 10)
        : parseInt(bandwidthOption, 10);
    if (isNaN(limit) || limit < 0) {
      addToast("Invalid bandwidth limit", "warning");
      return;
    }
    try {
      await api.setBandwidthLimit(limit);
      addToast("Bandwidth limit updated", "success");
    } catch (err) {
      addToast(`Failed to set bandwidth: ${err}`, "error");
    }
  };

  const handleSaveProxy = async () => {
    try {
      await api.setSetting("proxy_type", proxyType);
      if (proxyType !== "none") {
        await api.setSetting("proxy_host", proxyHost);
        await api.setSetting("proxy_port", proxyPort);
        if (proxyUsername) await api.setSetting("proxy_username", proxyUsername);
        if (proxyPassword) await api.setSetting("proxy_password", proxyPassword);
      }
      addToast("Proxy settings saved", "success");
    } catch (err) {
      addToast(`Failed to save proxy: ${err}`, "error");
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="flex flex-col gap-4">
            <Select
              label="Theme"
              value={theme}
              onChange={(e) =>
                setTheme(e.target.value as "light" | "dark" | "system")
              }
              options={THEME_OPTIONS}
            />
          </div>
        );

      case "transfer":
        return (
          <div className="flex flex-col gap-4">
            <Select
              label="Bandwidth Limit"
              value={bandwidthOption}
              onChange={(e) => setBandwidthOption(e.target.value)}
              options={BANDWIDTH_OPTIONS}
            />
            {bandwidthOption === "custom" && (
              <Input
                label="Custom Limit (bytes/s)"
                variant="number"
                value={customBandwidth}
                onChange={(e) => setCustomBandwidth(e.target.value)}
                placeholder="10485760"
              />
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveBandwidth}
              className="self-start"
            >
              Save
            </Button>
          </div>
        );

      case "monitors":
        return <MonitorList />;

      case "proxy":
        return (
          <div className="flex flex-col gap-4">
            <Select
              label="Proxy Type"
              value={proxyType}
              onChange={(e) => setProxyType(e.target.value)}
              options={PROXY_TYPE_OPTIONS}
            />
            {proxyType !== "none" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Host"
                    placeholder="127.0.0.1"
                    value={proxyHost}
                    onChange={(e) => setProxyHost(e.target.value)}
                  />
                  <Input
                    label="Port"
                    variant="number"
                    placeholder="8080"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Username (optional)"
                    placeholder="user"
                    value={proxyUsername}
                    onChange={(e) => setProxyUsername(e.target.value)}
                  />
                  <Input
                    label="Password (optional)"
                    variant="password"
                    placeholder="password"
                    value={proxyPassword}
                    onChange={(e) => setProxyPassword(e.target.value)}
                  />
                </div>
              </>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveProxy}
              className="self-start"
            >
              Save Proxy Settings
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={activeModal === "settings"}
      onClose={closeModal}
      title="Settings"
      size="xl"
      footer={
        <Button variant="secondary" onClick={closeModal}>
          Close
        </Button>
      }
    >
      <div className="flex gap-4 -mt-2">
        <div className="flex flex-col gap-0.5 w-36 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-0">{renderTab()}</div>
      </div>
    </Modal>
  );
}
