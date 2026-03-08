import { create } from "zustand";

export type ModalType =
  | "profileForm"
  | "profileList"
  | "presignedUrl"
  | "aclEditor"
  | "policyEditor"
  | "preview"
  | "versionHistory"
  | "syncModal"
  | "monitorSetup"
  | "settings"
  | "newFolder"
  | "rename"
  | "deleteConfirm"
  | "about"
  | null;

interface ModalStore {
  activeModal: ModalType;
  modalData: Record<string, unknown>;
  openModal: (modal: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  modalData: {},

  openModal: (modal: ModalType, data: Record<string, unknown> = {}) => {
    set({ activeModal: modal, modalData: data });
  },

  closeModal: () => {
    set({ activeModal: null, modalData: {} });
  },
}));
