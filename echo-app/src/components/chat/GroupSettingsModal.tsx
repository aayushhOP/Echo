import React, { useState, useEffect, useRef } from "react";
import { Shield, MessageSquare, Edit3, UserPlus, X, UserCheck, ChevronDown, Check, Loader2 } from "lucide-react";
import { IGroupSettings } from "../../types/message";

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IGroupSettings;
  onSaveSettings: (updatedSettings: IGroupSettings) => void;
  isUpdating?: boolean;
}

interface SettingDropdownProps {
  value: boolean;
  onChange: (val: boolean) => void;
  options: { label: string; value: boolean }[];
  disabled?: boolean;
}

const SettingDropdown: React.FC<SettingDropdownProps> = ({
  value,
  onChange,
  options,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium border transition-all cursor-pointer ${
          value
            ? "bg-[#0066ff]/15 border-[#0066ff]/40 text-[#38bdf8]"
            : "bg-[#232533] border-white/[0.08] text-slate-200 hover:bg-[#2b2d3d]"
        } disabled:opacity-50`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 text-slate-400 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-[#1c1e2b] border border-white/[0.1] shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                  isSelected
                    ? "bg-[#0066ff]/20 text-[#38bdf8] font-medium"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={14} className="text-[#38bdf8]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  isUpdating = false,
}) => {
  const [draftSettings, setDraftSettings] = useState<IGroupSettings>({
    onlyAdminsMessage: false,
    onlyAdminsEditInfo: false,
    onlyAdminsAddMembers: false,
    requireAdminApproval: false,
  });

  useEffect(() => {
    if (isOpen) {
      setDraftSettings({
        onlyAdminsMessage: !!settings.onlyAdminsMessage,
        onlyAdminsEditInfo: !!settings.onlyAdminsEditInfo,
        onlyAdminsAddMembers: !!settings.onlyAdminsAddMembers,
        requireAdminApproval: !!settings.requireAdminApproval,
      });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleUpdate = (key: keyof IGroupSettings, value: boolean) => {
    setDraftSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    onSaveSettings(draftSettings);
  };

  const adminOptions = [
    { label: "All Members", value: false },
    { label: "Only Admins", value: true },
  ];

  const approvalOptions = [
    { label: "Off", value: false },
    { label: "On", value: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#171824] border border-white/[0.08] p-6 shadow-2xl relative flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Shield size={18} className="text-[#0066ff]" />
            <span>Group Settings</span>
          </div>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings List */}
        <div className="mt-4 space-y-4">
          {/* Send Messages */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2 min-w-0">
              <MessageSquare size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">Send Messages</p>
                <p className="text-[11px] text-slate-400 leading-tight">Choose who can send messages to this group</p>
              </div>
            </div>
            <SettingDropdown
              value={draftSettings.onlyAdminsMessage}
              onChange={(val) => handleUpdate("onlyAdminsMessage", val)}
              options={adminOptions}
              disabled={isUpdating}
            />
          </div>

          {/* Edit Group Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2 min-w-0">
              <Edit3 size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">Edit Group Info</p>
                <p className="text-[11px] text-slate-400 leading-tight">Choose who can change group name, icon & description</p>
              </div>
            </div>
            <SettingDropdown
              value={draftSettings.onlyAdminsEditInfo}
              onChange={(val) => handleUpdate("onlyAdminsEditInfo", val)}
              options={adminOptions}
              disabled={isUpdating}
            />
          </div>

          {/* Add Other Members */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2 min-w-0">
              <UserPlus size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">Add Other Members</p>
                <p className="text-[11px] text-slate-400 leading-tight">Choose who can add new members</p>
              </div>
            </div>
            <SettingDropdown
              value={draftSettings.onlyAdminsAddMembers}
              onChange={(val) => handleUpdate("onlyAdminsAddMembers", val)}
              options={adminOptions}
              disabled={isUpdating}
            />
          </div>

          {/* Approve New Members */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2 min-w-0">
              <UserCheck size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">Approve New Members</p>
                <p className="text-[11px] text-slate-400 leading-tight">Require an admin to approve anyone who wants to join</p>
              </div>
            </div>
            <SettingDropdown
              value={draftSettings.requireAdminApproval}
              onChange={(val) => handleUpdate("requireAdminApproval", val)}
              options={approvalOptions}
              disabled={isUpdating}
            />
          </div>
        </div>

        {/* Modal Footer with Full Width Save Button */}
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-lg shadow-[#0066ff]/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isUpdating && <Loader2 size={14} className="animate-spin" />}
            <span>{isUpdating ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
