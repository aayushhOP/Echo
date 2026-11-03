import React, { useState, useEffect, useRef } from "react";
import { X, UserPlus, Mail, Phone, UserCheck, ChevronDown, Search } from "lucide-react";
import { useContactStore } from "../../store/contactStore";
import { COUNTRIES, CountryCode } from "../../utils/countries";

export const SaveContactModal: React.FC = () => {
  const {
    isAddContactModalOpen,
    selectedContactForEdit,
    closeAddContactModal,
    saveContact,
  } = useContactStore();

  const [savedName, setSavedName] = useState("");
  const [email, setEmail] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(COUNTRIES[0]); // Default to +91 India or matches
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedContactForEdit) {
      setSavedName(
        selectedContactForEdit.savedName ||
        selectedContactForEdit.username ||
        ""
      );
      setEmail(selectedContactForEdit.email || "");

      // Parse existing phoneNumber into dialCode + localNumber if possible
      const rawPhone = selectedContactForEdit.phoneNumber || "";
      if (rawPhone.startsWith("+")) {
        // Find longest matching dial code
        const matched = COUNTRIES.slice().sort((a, b) => b.dialCode.length - a.dialCode.length)
          .find((c) => rawPhone.startsWith(c.dialCode));
        if (matched) {
          setSelectedCountry(matched);
          setLocalNumber(rawPhone.slice(matched.dialCode.length).trim());
        } else {
          setLocalNumber(rawPhone);
        }
      } else {
        setLocalNumber(rawPhone);
      }

      setError(null);
      setIsCountryDropdownOpen(false);
      setCountrySearch("");
    }
  }, [selectedContactForEdit]);

  // Close dropdown on outside click
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

  if (!isAddContactModalOpen || !selectedContactForEdit) return null;

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase().trim()) ||
      c.dialCode.includes(countrySearch.trim()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase().trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedName.trim()) {
      setError("Please enter a name for this contact.");
      return;
    }

    const contactId =
      selectedContactForEdit.contactUserId ||
      selectedContactForEdit.targetMongoId ||
      selectedContactForEdit._id;

    if (!contactId) {
      setError("Target user identifier missing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const fullPhoneNumber = localNumber.trim()
      ? `${selectedCountry.dialCode} ${localNumber.trim()}`
      : "";

    try {
      await saveContact({
        contactUserId: contactId,
        savedName: savedName.trim(),
        email: email.trim(),
        phoneNumber: fullPhoneNumber,
      });

      closeAddContactModal();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to save contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-[#171824] border border-white/[0.08] shadow-2xl p-6 text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0066ff]/10 text-[#0066ff]">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Save to Contacts</h3>
              {selectedContactForEdit.username && (
                <p className="text-xs text-slate-400">@{selectedContactForEdit.username}</p>
              )}
            </div>
          </div>
          <button
            onClick={closeAddContactModal}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Contact Display Name */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Contact Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <UserCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={savedName}
                onChange={(e) => setSavedName(e.target.value)}
                placeholder="e.g. Aayush Colleague"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all"
              />
            </div>
          </div>

          {/* Phone Number with Country Code Dropdown */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Phone Number</label>
            <div className="flex items-center gap-2 relative">
              {/* Country Code Selector Trigger */}
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
                          const isSelected = c.code === selectedCountry.code && c.dialCode === selectedCountry.dialCode;
                          return (
                            <button
                              key={`${c.code}-${c.dialCode}`}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(c);
                                setIsCountryDropdownOpen(false);
                                setCountrySearch("");
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-xs transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-[#0066ff]/20 text-[#0066ff] font-semibold"
                                  : "text-slate-200 hover:bg-white/[0.06]"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-base leading-none shrink-0">{c.flag}</span>
                                <span className="truncate">{c.name}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0 ml-2 font-mono">
                                {c.dialCode}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-[11px] text-slate-400">
                          No country found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Local Number Input */}
              <div className="relative flex-1">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  value={localNumber}
                  onChange={(e) => setLocalNumber(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#13141d] border border-white/[0.08] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-[#0066ff]/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={closeAddContactModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066ff] hover:bg-[#0052cc] text-white transition-all shadow-lg shadow-[#0066ff]/25 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
