import React from "react";
import { Shield, MessageSquare, Edit3, UserPlus, X, UserCheck } from "lucide-react";
import { IGroupSettings } from "../../types/message";

interface GroupSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IGroupSettings;
  onUpdateSetting: (key: keyof IGroupSettings, value: boolean) => void;
  isUpdating?: boolean;
}

export const GroupSettingsModal: React.FC<GroupSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
  isUpdating = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#171824] border border-white/[0.08] p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Shield size={18} className="text-[#0066ff]" />
            <span>Group Settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.05] transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Send Messages Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2">
              <MessageSquare size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">Send Messages</p>
                <p className="text-[11px] text-slate-400">Choose who can send messages to this group</p>
              </div>
            </div>
            <button
              disabled={isUpdating}
              onClick={() => onUpdateSetting("onlyAdminsMessage", !settings.onlyAdminsMessage)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                settings.onlyAdminsMessage
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              } disabled:opacity-50`}
            >
              {settings.onlyAdminsMessage ? "Only Admins" : "All Members"}
            </button>
          </div>

          {/* Edit Group Info Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2">
              <Edit3 size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">Edit Group Info</p>
                <p className="text-[11px] text-slate-400">Choose who can change group name, icon & description</p>
              </div>
            </div>
            <button
              disabled={isUpdating}
              onClick={() => onUpdateSetting("onlyAdminsEditInfo", !settings.onlyAdminsEditInfo)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                settings.onlyAdminsEditInfo
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              } disabled:opacity-50`}
            >
              {settings.onlyAdminsEditInfo ? "Only Admins" : "All Members"}
            </button>
          </div>

          {/* Add Other Members Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2">
              <UserPlus size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">Add Other Members</p>
                <p className="text-[11px] text-slate-400">Choose who can add new members</p>
              </div>
            </div>
            <button
              disabled={isUpdating}
              onClick={() => onUpdateSetting("onlyAdminsAddMembers", !settings.onlyAdminsAddMembers)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                settings.onlyAdminsAddMembers
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              } disabled:opacity-50`}
            >
              {settings.onlyAdminsAddMembers ? "Only Admins" : "All Members"}
            </button>
          </div>

          {/* Approve New Members Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-2">
              <UserCheck size={16} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">Approve New Members</p>
                <p className="text-[11px] text-slate-400">Require an admin to approve anyone who wants to join</p>
              </div>
            </div>
            <button
              disabled={isUpdating}
              onClick={() => onUpdateSetting("requireAdminApproval", !settings.requireAdminApproval)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 cursor-pointer ${
                settings.requireAdminApproval
                  ? "bg-[#0066ff] text-white"
                  : "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
              } disabled:opacity-50`}
            >
              {settings.requireAdminApproval ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
