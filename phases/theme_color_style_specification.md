# Theme Color & UI Style Specification — Hyundai Dark Blue Aesthetic

**Target Stack:** React 19 · TypeScript · Tailwind CSS v4 · Lucide React

---

## 1. Aesthetic Analysis & Color Palette Breakdown

The reference interface features an elegant, cohesive **deep midnight navy/charcoal base** with a striking **electric royal blue** accent. Unlike generic pitch-black dark modes, it utilizes soft cool-slate undertones with high contrast, legible typography, and rounded message pills.

### 1.1 Color Tokens Matrix

| Role | Color Name | Hex Code | Tailwind / CSS Utility | Description |
|---|---|---|---|---|
| **Canvas Background** | Midnight Navy-Charcoal | `#13141d` | `bg-[#13141d]` | Deep outer frame & main wrapper background |
| **Nav Sidebar** | Dark Charcoal Rail | `#1b1c27` | `bg-[#1b1c27]` | Left-most navigation & profile drawer |
| **Chat List Panel** | Deep Navy Surface | `#161722` | `bg-[#161722]` | Conversation list background |
| **Active Chat Card** | Electric Royal Blue | `#0066ff` | `bg-[#0066ff]` | High-impact active conversation card |
| **Chat Canvas** | Mid Navy Slate | `#171824` | `bg-[#171824]` | Center/right message feed area |
| **Received Bubble** | Slate Pill | `#232533` | `bg-[#232533]` | Received messages, rounded capsule style |
| **Sent Bubble** | Electric Royal Blue | `#0066ff` | `bg-[#0066ff]` | Sent message bubble |
| **Date Dividers** | Muted Slate Text | `#5f6377` | `text-[#5f6377]` | Center timestamps (e.g. `Tuesday, 05.02.2026`) |
| **Text Primary** | Crisp Pure White | `#ffffff` | `text-white` | Headings, active card text, sent messages |
| **Text Secondary** | Cool Muted Lavender | `#767b93` | `text-[#767b93]` | Timestamps, snippets, navigation labels |
| **Text Subtle** | Faded Slate | `#505469` | `text-[#505469]` | Placeholders and inactive icon strokes |
| **Action Icon Accent**| Electric Blue | `#0066ff` | `text-[#0066ff]` | Send button, audio/video call icons |
| **Avatar Glow** | Blue Halo Accent | `rgba(0,102,255,0.4)` | `ring-2 ring-[#0066ff]` | Current user & active avatar accent |

---

## 2. Global CSS Variables Setup (`client/src/index.css`)

Update `client/src/index.css` to expose these custom theme tokens:

```css
@import "tailwindcss";

@layer base {
  :root {
    --bg-app: #13141d;
    --bg-rail: #1b1c27;
    --bg-panel: #161722;
    --bg-canvas: #171824;
    --bg-received: #232533;
    --bg-received-hover: #2a2c3d;
    --accent-blue: #0066ff;
    --accent-blue-hover: #005ce6;
    --text-primary: #ffffff;
    --text-muted: #767b93;
    --text-subtle: #505469;
    --border-subtle: rgba(255, 255, 255, 0.04);
  }

  body {
    background-color: var(--bg-app);
    color: var(--text-primary);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    overflow: hidden;
  }

  /* Custom Slim Scrollbars */
  ::-webkit-scrollbar {
    width: 5px;
    height: 5px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #252737;
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #34374c;
  }
}
```

---

## 3. Component Theme Transformations

### 3.1 Main Container Frame (`client/src/pages/ChatPage.tsx`)
In the reference UI, the application sits inside a framed container with smooth rounded outer corners:

```tsx
<div className="h-screen w-screen bg-[#13141d] p-3 flex select-none">
  <div className="flex-1 flex overflow-hidden rounded-3xl bg-[#171824] border border-white/[0.04] shadow-2xl">
    {/* 1. Left Nav Rail */}
    {/* 2. Conversation List */}
    {/* 3. Main Chat Canvas */}
  </div>
</div>
```

---

### 3.2 Conversation List Panel (`client/src/components/chat/ConversationList.tsx`)

#### Color & Layout Rules:
1. **Background:** `bg-[#161722]`
2. **Search Input:** Borderless, clean dark inset:
   `bg-[#13141d] text-white placeholder-[#505469] text-xs rounded-xl px-3 py-2.5`
3. **Active Conversation Card:**
   - Must turn into a solid **Electric Royal Blue** pill card (`bg-[#0066ff] text-white rounded-2xl shadow-lg shadow-[#0066ff]/20 p-3.5`).
   - Counterpart name: `text-white font-semibold text-sm`.
   - Timestamp/Last seen: `text-white/80 text-[11px]`.
   - Typing indicator or message snippet: `text-white/90 text-xs`.
4. **Inactive Conversation Items:**
   - Background: `bg-transparent hover:bg-white/[0.02] p-3.5 rounded-2xl transition-colors`.
   - Contact name: `text-[#f0f2f8] font-medium text-sm`.
   - Timestamp: `text-[#767b93] text-[11px]`.
   - Last message snippet: `text-[#767b93] text-xs truncate`.

```tsx
{/* Active Card Example */}
<div
  key={chat._id}
  onClick={() => onSelect(chat._id)}
  className={`flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all ${
    isActive
      ? "bg-[#0066ff] text-white shadow-md shadow-[#0066ff]/25"
      : "hover:bg-white/[0.02] text-[#f0f2f8]"
  }`}
>
  <div className="relative">
    <img
      src={chat.avatarUrl || "/default-avatar.png"}
      className={`w-11 h-11 rounded-full object-cover ${
        isActive ? "ring-2 ring-white/30" : "ring-1 ring-white/10"
      }`}
    />
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex justify-between items-baseline mb-0.5">
      <span className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-[#f0f2f8]"}`}>
        {chat.name}
      </span>
      <span className={`text-[11px] shrink-0 ${isActive ? "text-white/80" : "text-[#767b93]"}`}>
        {chat.time}
      </span>
    </div>
    <p className={`text-xs truncate ${isActive ? "text-white/90" : "text-[#767b93]"}`}>
      {chat.lastMessage}
    </p>
  </div>
</div>
```

---

### 3.3 Main Chat Canvas & Header (`client/src/components/chat/ChatWindow.tsx`)

#### Color & Layout Rules:
1. **Background:** `bg-[#171824]`
2. **Top Header:**
   - Background: `bg-[#171824] border-b border-white/[0.04]`
   - Counterpart Name: `text-white font-semibold text-sm`
   - Subtitle/Role: `text-[#767b93] text-xs` (e.g., `Salesperson` or `Active now`)
   - Header Action Icons: Audio, Video, and Menu icons in `text-[#767b93] hover:text-[#0066ff]`
3. **Centered Date Separators:**
   - Inset date text: `text-[#5f6377] text-[11px] tracking-wide my-4 select-none text-center font-normal` (e.g., `Tuesday, 05.02.2026`)
4. **Live Typing Indicator:**
   - Small electric blue dot followed by text:
   ```tsx
   <div className="flex items-center gap-2 text-xs text-[#767b93] mt-2 mb-1">
     <span className="w-1.5 h-1.5 rounded-full bg-[#0066ff] animate-pulse" />
     <span>{activeConversation.name} is typing...</span>
   </div>
   ```

---

### 3.4 Message Bubbles (`client/src/components/chat/MessageBubble.tsx`)

#### Visual Shape & Colors:
* **Received Messages (Left):**
  - Surface: `bg-[#232533] text-[#f1f3f9]`
  - Shape: Rounded capsule `rounded-2xl rounded-tl-sm`
  - Inline spacing: Tight margin between consecutive messages from the same sender (`gap-1.5`)
  - Padding: `px-4 py-2.5`
  - Text: `text-xs md:text-sm font-normal leading-relaxed`

* **Sent Messages (Right):**
  - Surface: `bg-[#0066ff] text-white`
  - Shape: Rounded capsule `rounded-2xl rounded-tr-sm`
  - Shadow: `shadow-md shadow-[#0066ff]/20`
  - Text: `text-xs md:text-sm font-normal leading-relaxed`

```tsx
<div className={`flex flex-col mb-1.5 ${isOwn ? "items-end" : "items-start"}`}>
  <div
    className={`max-w-md px-4 py-2.5 text-xs md:text-sm leading-relaxed transition-all ${
      isOwn
        ? "bg-[#0066ff] text-white rounded-2xl rounded-tr-sm shadow-md shadow-[#0066ff]/20"
        : "bg-[#232533] text-[#f0f2f8] rounded-2xl rounded-tl-sm hover:bg-[#282a3b]"
    }`}
  >
    <p className="whitespace-pre-wrap break-words">{message.content}</p>
  </div>
</div>
```

---

### 3.5 Bottom Docked Input Bar (`client/src/components/chat/MessageInput.tsx`)

#### Color & Layout Rules:
* In the reference UI, the input area is ultra-clean, minimal, and floating above the bottom edge without thick borders.
* Surface: `bg-[#13141d]/70 border border-white/[0.04] rounded-2xl px-4 py-2.5 flex items-center gap-3`
* Text input: `bg-transparent text-sm text-[#f0f2f8] placeholder-[#505469] focus:outline-none flex-1`
* Icons:
  - Attachment clip (`Paperclip`): `text-[#505469] hover:text-[#767b93]`
  - Emoji face (`Smile`): `text-[#505469] hover:text-[#767b93]`
  - Send paper-plane (`Send`): `text-[#0066ff] hover:text-[#005ce6] transition-transform active:scale-95`

```tsx
<div className="p-4 bg-[#171824]">
  <div className="max-w-3xl mx-auto flex items-center gap-3 bg-[#13141d] border border-white/[0.04] rounded-2xl px-4 py-3 shadow-inner">
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Type something..."
      className="flex-1 bg-transparent text-sm text-[#f0f2f8] placeholder-[#505469] focus:outline-none"
    />
    <button className="text-[#505469] hover:text-[#767b93] transition-colors p-1">
      <Paperclip size={18} />
    </button>
    <button className="text-[#505469] hover:text-[#767b93] transition-colors p-1">
      <Smile size={18} />
    </button>
    <button
      onClick={handleSend}
      className="text-[#0066ff] hover:text-[#3385ff] disabled:text-[#313545] transition-all p-1"
    >
      <Send size={18} />
    </button>
  </div>
</div>
```

---

## 4. Verification Checklist for the Agent

- [ ] Outer background updated to deep navy-charcoal `#13141d` with rounded main application frame (`rounded-3xl`).
- [ ] Active conversation in list highlights in bold **Electric Royal Blue** (`#0066ff`) with white text and avatar glow.
- [ ] Inactive conversations use `#161722` surface with `#767b93` secondary text.
- [ ] Received message bubbles use rounded `#232533` slate capsules.
- [ ] Sent message bubbles use `#0066ff` blue capsules with white text.
- [ ] Date dividers are centered with subtle `#5f6377` slate text (e.g. `Tuesday, 05.02.2026`).
- [ ] Input bar has dark `#13141d` background, `"Type something..."` placeholder in `#505469`, and an electric blue send icon.