import { FC, useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { notificationService } from "../../services/notificationService";

export const NotificationPermissionBanner: FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const dismissed = localStorage.getItem("echo_notification_banner_dismissed");
    if (Notification.permission === "default" && !dismissed) {
      setShow(true);
    }
  }, []);

  const handleEnable = async () => {
    const granted = await notificationService.requestDesktopPermission();
    if (granted || Notification.permission !== "default") {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("echo_notification_banner_dismissed", "true");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="w-full bg-gradient-to-r from-[#0066ff]/20 via-[#0066ff]/10 to-transparent border-b border-[#0066ff]/30 px-4 py-2.5 flex items-center justify-between text-xs text-slate-200 select-none animate-in slide-in-from-top-2 duration-200 z-30">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-[#0066ff]/20 text-[#0066ff] flex items-center justify-center shrink-0">
          <Bell size={14} className="animate-bounce" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white truncate">
            Enable desktop notifications
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Get instant OS alerts for new messages even when Echo is running in another tab or minimized.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          type="button"
          onClick={handleEnable}
          className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-sm shadow-[#0066ff]/25 transition-all cursor-pointer active:scale-95"
        >
          Enable
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
