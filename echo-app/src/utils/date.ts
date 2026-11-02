import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function formatDateSeparator(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${day}, ${dd}.${mm}.${yyyy}`;
  } catch {
    return "";
  }
}

export function formatLastSeen(isoString: string): string {
  try {
    const target = new Date(isoString);
    if (isNaN(target.getTime())) return "";

    const timeStr = formatTime(isoString);
    const now = new Date();

    const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Last seen today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Last seen yesterday at ${timeStr}`;
    } else {
      const dd = String(target.getDate()).padStart(2, "0");
      const mm = String(target.getMonth() + 1).padStart(2, "0");
      const yyyy = target.getFullYear();
      return `Last seen on ${dd}/${mm}/${yyyy} at ${timeStr}`;
    }
  } catch {
    return "";
  }
}
