import { FC, useState } from "react";
import { Bell, Check } from "lucide-react";
import { notificationService } from "../../services/notificationService";

export const NotificationSettings: FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestDesktopPermission();
    setPermission(granted ? "granted" : "denied");
  };

  return (
    <div className="p-4 rounded-2xl bg-[#171824] border border-white/[0.06] flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
          <Bell size={18} />
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">Desktop Notifications</h4>
          <p className="text-xs text-slate-400">Receive alerts when the app is in the background</p>
        </div>
      </div>

      {permission === "granted" ? (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
          <Check size={14} />
          Enabled
        </span>
      ) : (
        <button
          type="button"
          onClick={handleEnableNotifications}
          className="text-xs px-3.5 py-1.5 rounded-lg font-medium bg-[#0066ff] hover:bg-[#0052cc] text-white transition-colors cursor-pointer"
        >
          Enable
        </button>
      )}
    </div>
  );
};
