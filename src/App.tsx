import { useEffect } from "react";
import "./App.css";

import { useThemeStore } from "./stores/themeStore";

import { Sidebar } from "./components/layout/Sidebar";
import { DualPanelLayout } from "./components/layout/DualPanelLayout";
import { TransferPanel } from "./components/transfers/TransferPanel";
import { ToastContainer } from "./components/ui/Toast";

import { ProfileForm } from "./components/profiles/ProfileForm";
import { ProfileList } from "./components/profiles/ProfileList";
import { PresignedModal } from "./components/presigned/PresignedModal";
import { AclEditorModal } from "./components/acl/AclEditorModal";
import { PolicyEditorModal } from "./components/policies/PolicyEditorModal";
import { PreviewPanel } from "./components/preview/PreviewPanel";
import { VersionHistoryModal } from "./components/versioning/VersionHistoryModal";
import { SyncModal } from "./components/sync/SyncModal";
import { MonitorSetupModal } from "./components/monitor/MonitorSetupModal";
import { SettingsPage } from "./components/settings/SettingsPage";
import { NewFolderModal } from "./components/explorer/NewFolderModal";
import { RenameModal } from "./components/explorer/RenameModal";
import { DeleteConfirmModal } from "./components/explorer/DeleteConfirmModal";
import { AboutModal } from "./components/about/AboutModal";

function App() {
  const { initialize } = useThemeStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="h-screen w-screen flex bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-gray-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <DualPanelLayout />
        <TransferPanel />
      </div>

      {/* Modal portals */}
      <ProfileForm />
      <ProfileList />
      <PresignedModal />
      <AclEditorModal />
      <PolicyEditorModal />
      <PreviewPanel />
      <VersionHistoryModal />
      <SyncModal />
      <MonitorSetupModal />
      <SettingsPage />
      <NewFolderModal />
      <RenameModal />
      <DeleteConfirmModal />
      <AboutModal />

      {/* Toast container */}
      <ToastContainer />
    </div>
  );
}

export default App;
