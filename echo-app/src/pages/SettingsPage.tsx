import React, { useState, useRef, useEffect, FC } from "react";
import { useUser } from "@clerk/clerk-react";
import {
  Laptop,
  User,
  Lock,
  MessageSquare,
  Bell,
  Camera,
  ChevronRight,
  Ban,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Volume2,
  ChevronDown,
  Search,
} from "lucide-react";
import { AvatarCropModal } from "../components/settings/AvatarCropModal";
import { notificationService } from "../services/notificationService";
import { userApi } from "../api/userApi";
import { useAuthStore } from "../store/authStore";
import { UserSearchItem } from "../types/user";
import { COUNTRIES, CountryCode } from "../utils/countries";
import { resolveAvatarUrl } from "../utils/chatUtils";

type SettingsTab = "profile" | "privacy" | "notifications" | "general" | "chats" | "help";

export const SettingsPage: FC = () => {
  const { user: clerkUser } = useUser();
  const currentUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const removeBlockedUserStore = useAuthStore((state) => state.removeBlockedUser);

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Profile Form States
  const [about, setAbout] = useState(
    currentUser?.about || currentUser?.status || "Hey there! I am using Echo."
  );
  
  // Phone number state with country code component
  const [localPhone, setLocalPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]); // Default +91 India
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const countrySearchInputRef = useRef<HTMLInputElement | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string>(
    currentUser?.avatarUrl || clerkUser?.imageUrl || ""
  );
  const [selectedCropFile, setSelectedCropFile] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Blocked Contacts State
  const [blockedList, setBlockedList] = useState<UserSearchItem[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Notifications State
  const [desktopEnabled, setDesktopEnabled] = useState(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission === "granted"
      : false
  );
  const [messageChime, setMessageChime] = useState(true);

  // General & Chats preferences
  const [autoDownloadMedia, setAutoDownloadMedia] = useState(true);
  const [enterToSend, setEnterToSend] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse existing phone number into country code + local number
  const parsePhoneToState = (rawPhone: string) => {
    if (!rawPhone) {
      setLocalPhone("");
      return;
    }
    const trimmed = rawPhone.trim();
    if (trimmed.startsWith("+")) {
      const sortedCountries = COUNTRIES.slice().sort((a, b) => b.dialCode.length - a.dialCode.length);
      const matched = sortedCountries.find((c) => trimmed.startsWith(c.dialCode));
      if (matched) {
        setSelectedCountry(matched);
        setLocalPhone(trimmed.slice(matched.dialCode.length).trim());
        return;
      }
    }
    setLocalPhone(trimmed);
  };

  // Sync state when currentUser or clerkUser loads
  useEffect(() => {
    if (currentUser) {
      if (currentUser.avatarUrl) {
        setAvatarPreview(currentUser.avatarUrl);
      } else if (clerkUser?.imageUrl) {
        setAvatarPreview(clerkUser.imageUrl);
      }
      if (currentUser.about || currentUser.status) {
        setAbout(currentUser.about || currentUser.status || "Hey there! I am using Echo.");
      }
      const existingPhone = currentUser.phoneNumber || currentUser.phone || "";
      parsePhoneToState(existingPhone);
    } else if (clerkUser?.imageUrl) {
      setAvatarPreview(clerkUser.imageUrl);
    }
  }, [currentUser, clerkUser]);

  // Close country dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    if (isCountryDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      setTimeout(() => countrySearchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCountryDropdownOpen]);

  // Initial blocked list load
  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    setIsLoadingBlocked(true);
    try {
      const contacts = await userApi.getBlockedContacts();
      setBlockedList(contacts || []);
    } catch (err) {
      console.error("Could not fetch blocked users", err);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  // Strict File Picker Ingestion (.jpg, .jpeg, .png only)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMime = ["image/jpeg", "image/jpg", "image/png"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!allowedMime.includes(file.type) || ![".jpg", ".jpeg", ".png"].includes(fileExt)) {
      alert("Invalid format! Only JPG, JPEG, and PNG images are supported.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedCropFile(reader.result as string);
      setIsCropOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected if cancelled
    e.target.value = "";
  };

  // Upload Cropped Blob
  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      const res = await userApi.updateAvatar(croppedBlob);
      if (res.success && res.avatarUrl) {
        setAvatarPreview(res.avatarUrl);
        updateUser({ avatarUrl: res.avatarUrl });
        setProfileSuccessMsg("Profile photo updated successfully!");
        setTimeout(() => setProfileSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      console.error("Failed to upload avatar", err);
      setProfileErrorMsg(err.response?.data?.message || "Failed to upload avatar");
      setTimeout(() => setProfileErrorMsg(null), 4000);
    }
  };

  // Save profile details (about / status / optional phone)
  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
    setIsSavingProfile(true);

    try {
      const formattedPhone = localPhone.trim() ? `${selectedCountry.dialCode} ${localPhone.trim()}` : "";
      const res = await userApi.updateProfileDetails({
        about: about.trim(),
        phoneNumber: formattedPhone,
        phone: formattedPhone,
      });
      if (res.success && res.user) {
        updateUser(res.user);
        setProfileSuccessMsg("Profile updated successfully!");
        setTimeout(() => setProfileSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setProfileErrorMsg(err.response?.data?.message || "Failed to update profile details");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUnblockUser = async (targetUserId: string) => {
    setUnblockingId(targetUserId);
    try {
      await userApi.unblockUser(targetUserId);
      setBlockedList((prev) =>
        prev.filter((u) => u.id !== targetUserId && (u as any)._id !== targetUserId && u.clerkId !== targetUserId)
      );
      removeBlockedUserStore(targetUserId);
    } catch (err) {
      console.error("Unblock failed", err);
    } finally {
      setUnblockingId(null);
    }
  };

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase().trim()) ||
      c.dialCode.includes(countrySearch.trim()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase().trim())
  );

  const displayName =
    clerkUser?.fullName ||
    currentUser?.username ||
    clerkUser?.username ||
    "Echo User";

  const resolvedDisplayAvatar = resolveAvatarUrl(avatarPreview || clerkUser?.imageUrl || "");

  return (
    <div className="h-full w-full flex bg-[#13141d] text-slate-100 overflow-hidden">
      {/* 1. LEFT SIDEBAR: Navigation Menu (matches width of ConversationList panel) */}
      <div className="w-full md:w-[35%] md:min-w-[340px] md:max-w-[550px] h-full border-r border-white/[0.06] bg-[#171824]/60 flex flex-col shrink-0">
        {/* Profile Card Header */}
        <div className="p-6 border-b border-white/[0.06] flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden bg-slate-800 border-2 border-[#0066ff]/30 shrink-0">
            {resolvedDisplayAvatar ? (
              <img src={resolvedDisplayAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-white bg-slate-800">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white truncate">{displayName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs text-slate-400 truncate">{about || "Hey there! I am using Echo."}</span>
            </div>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1 px-3">
          {[
            { id: "general", label: "General", desc: "Startup and preferences", icon: Laptop },
            { id: "profile", label: "Profile", desc: "Name, photo, status", icon: User },
            { id: "privacy", label: "Privacy", desc: "Blocked contacts, last seen", icon: Lock },
            { id: "chats", label: "Chats", desc: "Theme, wallpaper, chat history", icon: MessageSquare },
            { id: "notifications", label: "Notifications", desc: "Alerts, tones, previews", icon: Bell },
            { id: "help", label: "Help", desc: "Help centre, contact us, licenses", icon: HelpCircle },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveTab(item.id as SettingsTab)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0066ff]/15 border border-[#0066ff]/30 text-white"
                    : "hover:bg-white/[0.04] text-slate-300"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#0066ff]" : "text-slate-400"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{item.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                </div>
                <ChevronRight size={14} className="text-slate-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. RIGHT VIEW: Category Details */}
      <div className="flex-1 h-full overflow-y-auto p-10 bg-[#13141d]">
        <div className="max-w-2xl mx-auto">
          {/* Notifications / Alerts banner */}
          {profileSuccessMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center gap-2.5 text-xs text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-8 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Profile Information</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage your personal details and how other users see your profile
                </p>
              </div>

              {/* Avatar Uploader Section */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#171824] border border-white/[0.06]">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to change profile photo"
                >
                  <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#0066ff]/20 bg-slate-900 shadow-xl">
                    {resolvedDisplayAvatar ? (
                      <img
                        src={resolvedDisplayAvatar}
                        alt="Profile"
                        className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-slate-800">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {/* Camera overlay hover */}
                  <div className="absolute inset-0 rounded-full flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">CHANGE PHOTO</span>
                  </div>
                </div>

                {/* Hidden File Input strictly accepting jpg, jpeg, png */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <p className="text-xs text-slate-400 mt-3">Click picture to frame & upload</p>
              </div>

              {/* Profile Fields */}
              <form
                onSubmit={handleSaveProfileDetails}
                className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-5"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser?.username || clerkUser?.username || ""}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.06] text-slate-400 text-xs cursor-not-allowed"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Your unique username cannot be modified
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    What's happening? (About / Status)
                  </label>
                  <input
                    type="text"
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    placeholder="Hey there! I am using Echo."
                    className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-[#0066ff]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Brief status message visible to your contacts
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Phone Number <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <div className="flex items-center gap-2 relative">
                    {/* Country Code Selector */}
                    <div ref={dropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                        className="h-11 px-3 rounded-xl bg-[#13141d] border border-white/[0.08] hover:border-white/20 text-white text-xs flex items-center gap-1.5 focus:outline-none focus:border-[#0066ff] transition-all cursor-pointer shrink-0"
                        title={`${selectedCountry.name} (${selectedCountry.dialCode})`}
                      >
                        <span className="text-base leading-none">{selectedCountry.flag}</span>
                        <span className="font-medium text-slate-200">{selectedCountry.dialCode}</span>
                        <ChevronDown
                          size={14}
                          className={`text-slate-400 transition-transform duration-150 ${
                            isCountryDropdownOpen ? "rotate-180 text-[#0066ff]" : ""
                          }`}
                        />
                      </button>

                      {/* Dropdown Menu */}
                      {isCountryDropdownOpen && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-64 max-h-60 rounded-xl bg-[#171824] border border-white/[0.1] shadow-2xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          {/* Search inside dropdown */}
                          <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#171824]">
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={countrySearchInputRef}
                                type="text"
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                placeholder="Search country..."
                                className="w-full h-8 pl-8 pr-2 rounded-lg bg-[#13141d] border border-white/[0.06] text-white text-[11px] placeholder-slate-500 focus:outline-none focus:border-[#0066ff]"
                              />
                            </div>
                          </div>

                          {/* Country List */}
                          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                            {filteredCountries.length > 0 ? (
                              filteredCountries.map((c) => {
                                const isSelected =
                                  c.code === selectedCountry.code && c.dialCode === selectedCountry.dialCode;
                                return (
                                  <button
                                    key={`${c.code}-${c.dialCode}`}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setIsCountryDropdownOpen(false);
                                      setCountrySearch("");
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                                      isSelected
                                        ? "bg-[#0066ff]/20 text-[#0066ff] font-semibold"
                                        : "hover:bg-white/[0.06] text-slate-300"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="text-sm leading-none">{c.flag}</span>
                                      <span className="truncate">{c.name}</span>
                                    </div>
                                    <span className="font-mono text-[11px] text-slate-400 shrink-0 ml-2">
                                      {c.dialCode}
                                    </span>
                                  </button>
                                );
                              })
                            ) : (
                              <p className="p-3 text-[11px] text-slate-500 text-center">No countries found</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Local phone number input */}
                    <div className="flex-1 relative">
                      <input
                        type="tel"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                        placeholder="0000000000"
                        className="w-full h-11 px-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>Save Profile Changes</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: PRIVACY & BLOCKED CONTACTS */}
          {activeTab === "privacy" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Privacy Settings</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage blocked contacts and communication privacy
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Ban size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Blocked Contacts</h3>
                    <p className="text-xs text-slate-400">
                      {blockedList.length} contact{blockedList.length === 1 ? "" : "s"} blocked
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {isLoadingBlocked ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                      <Loader2 size={16} className="animate-spin text-[#0066ff]" />
                      <span>Loading blocked contacts...</span>
                    </div>
                  ) : blockedList.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No blocked contacts.</p>
                  ) : (
                    blockedList.map((contact) => {
                      const cid = contact.id || (contact as any)._id || contact.clerkId;
                      const isUnblocking = unblockingId === cid;
                      const contactAvatar = resolveAvatarUrl(contact.avatarUrl);

                      return (
                        <div key={cid} className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                              {contactAvatar ? (
                                <img
                                  src={contactAvatar}
                                  alt={contact.username}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-white">
                                  {contact.username?.slice(0, 2).toUpperCase() || "??"}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-white">@{contact.username}</p>
                              <p className="text-[10px] text-slate-400">
                                {contact.about || contact.status || "Hey there! I am using Echo."}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isUnblocking}
                            onClick={() => handleUnblockUser(cid)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isUnblocking ? "Unblocking..." : "Unblock"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-4">
                <h3 className="text-sm font-semibold text-white">Disappearing Messages</h3>
                <p className="text-xs text-slate-400">
                  New messages sent in conversations can be configured with disappearing timers inside each individual chat details.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Notifications</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Configure desktop alerts, message sounds, and incoming call previews
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
                      <Bell size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Desktop Notifications</p>
                      <p className="text-[11px] text-slate-400">
                        Show system notification banners for incoming messages
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const granted = await notificationService.requestDesktopPermission();
                      setDesktopEnabled(granted);
                    }}
                    className={`text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      desktopEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-[#0066ff] text-white hover:bg-[#0052cc]"
                    }`}
                  >
                    {desktopEnabled ? "Enabled" : "Enable"}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
                      <Volume2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">Message Sound Chimes</p>
                      <p className="text-[11px] text-slate-400">Play an audio chime when receiving messages</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={messageChime}
                    onChange={(e) => setMessageChime(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0066ff] bg-[#13141d] border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">General Settings</h2>
                <p className="text-xs text-slate-400 mt-1">Application preferences and launch behavior</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Start Echo on login</p>
                    <p className="text-[11px] text-slate-400">Open Echo automatically when your computer starts</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked={false}
                    className="w-4 h-4 rounded text-[#0066ff] bg-[#13141d] border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div>
                    <p className="text-xs font-medium text-white">Auto-download media</p>
                    <p className="text-[11px] text-slate-400">Automatically download voice notes and images</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDownloadMedia}
                    onChange={(e) => setAutoDownloadMedia(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0066ff] bg-[#13141d] border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div>
                    <p className="text-xs font-medium text-white">Language</p>
                    <p className="text-[11px] text-slate-400">System default (English - United States)</p>
                  </div>
                  <span className="text-xs text-slate-400 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                    English
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CHATS */}
          {activeTab === "chats" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Chat Settings</h2>
                <p className="text-xs text-slate-400 mt-1">Theme, wallpaper, and composer behavior</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Enter is send</p>
                    <p className="text-[11px] text-slate-400">Pressing Enter sends the message; Shift + Enter creates a newline</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enterToSend}
                    onChange={(e) => setEnterToSend(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0066ff] bg-[#13141d] border-white/20 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                  <div>
                    <p className="text-xs font-medium text-white">Chat wallpaper</p>
                    <p className="text-[11px] text-slate-400">WhatsApp Doodle dark slate theme active</p>
                  </div>
                  <span className="text-xs text-[#0066ff] bg-[#0066ff]/10 border border-[#0066ff]/30 px-3 py-1.5 rounded-lg font-medium">
                    Default Doodle
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: HELP */}
          {activeTab === "help" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Help & About</h2>
                <p className="text-xs text-slate-400 mt-1">Version details and application support</p>
              </div>

              <div className="p-6 rounded-2xl bg-[#171824] border border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Version</p>
                    <p className="text-[11px] text-slate-400">Echo Desktop v1.2.0 (Stable Release)</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    Up to date
                  </span>
                </div>

                <div className="pt-4 border-t border-white/[0.06]">
                  <p className="text-xs font-medium text-white">Terms & Privacy Policy</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    End-to-end user privacy encrypted communication stack. Built with React 19, TypeScript, and Express 5.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Crop Adjustment Modal */}
      <AvatarCropModal
        imageSrc={selectedCropFile}
        isOpen={isCropOpen}
        onClose={() => setIsCropOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
