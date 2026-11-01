import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, Shield, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { groupApi } from "../api/groupApi";
import { useChatStore } from "../store/chatStore";

export const InvitePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinSuccessMessage, setJoinSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No invite token provided");
      setLoading(false);
      return;
    }

    const fetchGroup = async () => {
      try {
        setLoading(true);
        const res = await groupApi.getGroupByInvite(token);
        if (res.success && res.group) {
          setGroup(res.group);
        } else {
          setError("Failed to load invite info");
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || "Invalid or expired invite link");
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    try {
      setJoining(true);
      const res = await groupApi.joinByInvite(token);
      if (res.success) {
        if (res.pendingApproval) {
          setJoinSuccessMessage("Your request to join has been sent to group admins.");
        } else {
          if (res.conversationId) {
            setActiveConversationId(res.conversationId);
          }
          navigate("/chat");
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || "Failed to join group");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e1017] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-[#0066ff]" />
          <p className="text-sm">Verifying group invite...</p>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-[#0e1017] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161722] border border-white/[0.08] rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 mx-auto flex items-center justify-center mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Invite Link Invalid</h2>
          <p className="text-xs text-slate-400 mb-6">
            {error || "This invite link is invalid or has been revoked by an administrator."}
          </p>
          <button
            onClick={() => navigate("/chat")}
            className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white transition cursor-pointer"
          >
            Return to Echo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e1017] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#161722] border border-white/[0.08] rounded-3xl p-8 text-center shadow-2xl flex flex-col items-center">
        {/* Group Avatar */}
        <div className="w-24 h-24 rounded-full bg-[#1b1c27] border-2 border-white/[0.1] flex items-center justify-center text-white overflow-hidden shadow-inner ring-4 ring-[#0066ff]/20 mb-4">
          {group.avatarUrl || group.groupAvatar ? (
            <img
              src={group.avatarUrl || group.groupAvatar}
              alt={group.name || group.groupName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Users className="w-10 h-10 text-[#0066ff]" />
          )}
        </div>

        <h2 className="text-xl font-bold text-white mb-1">{group.name || group.groupName}</h2>
        <p className="text-xs text-[#767b93] mb-4">
          Group · {group.memberCount} {group.memberCount === 1 ? "participant" : "participants"}
        </p>

        {group.description && (
          <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
            {group.description}
          </p>
        )}

        {group.settings?.requireAdminApproval && (
          <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
            <Shield size={14} className="shrink-0" />
            <span>Admin approval is required to join this group</span>
          </div>
        )}

        {joinSuccessMessage ? (
          <div className="w-full p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-xs">
              <CheckCircle size={16} />
              <span>Request Submitted</span>
            </div>
            <p className="text-[11px] text-slate-300">{joinSuccessMessage}</p>
            <button
              onClick={() => navigate("/chat")}
              className="mt-2 w-full py-2 rounded-xl bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition cursor-pointer"
            >
              Back to Echo
            </button>
          </div>
        ) : (
          <div className="w-full space-y-3">
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 rounded-2xl bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-semibold shadow-lg shadow-[#0066ff]/25 transition transform active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining...</span>
                </>
              ) : (
                <span>
                  {group.settings?.requireAdminApproval ? "Request to Join" : "Join Group"}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="w-full py-2.5 rounded-2xl bg-transparent hover:bg-white/[0.04] text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
