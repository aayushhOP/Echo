import { FC, useState, FormEvent } from "react";
import { userApi } from "../api/userApi";
import { useAuthStore } from "../store/authStore";
import { Avatar } from "../components/common/Avatar";
import { User, Image, AlignLeft, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export const ProfilePage: FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [status, setStatus] = useState(currentUser?.status || "");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      const updated = await userApi.updateMe({
        status: status.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      updateUser(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 p-6 md:p-12 overflow-y-auto">
      <div className="max-w-xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">My Profile</h1>
        <p className="text-sm text-slate-400 mb-8">
          Manage your account appearance and status message
        </p>

        {success && (
          <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Avatar preview */}
          <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
            <Avatar
              name={currentUser?.username || "User"}
              avatarUrl={avatarUrl || currentUser?.avatarUrl}
              size="lg"
            />
            <div>
              <h2 className="text-base font-semibold text-white">
                {currentUser?.username}
              </h2>
              <p className="text-xs text-slate-400">{currentUser?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  disabled
                  value={currentUser?.username || ""}
                  className="w-full bg-slate-800/50 border border-slate-700/40 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Username cannot be changed
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Avatar Image URL
              </label>
              <div className="relative">
                <Image className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Status Message
              </label>
              <div className="relative">
                <AlignLeft className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  maxLength={100}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Available / Busy / Working on Echo..."
                  className="w-full bg-slate-800 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
