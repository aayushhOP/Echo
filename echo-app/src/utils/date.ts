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
