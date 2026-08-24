import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function initials(name?: string | null) { return (name || "User").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
export function formatDate(value: string) { return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
export function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
export function titleForItem(item: { material_description?: string | null; material_number?: string | null; wo_number?: string | null }) { return item.material_description || item.material_number || item.wo_number || "Unlabelled part"; }
export function availableQuantity(original: number | null, removed = 0) { return original === null ? null : Math.max(0, original - removed); }
export function itemStatus(quantity: number | null, removed: number, manuallyRemoved = false) { const available = availableQuantity(quantity, removed); return manuallyRemoved || available === 0 ? "Fully Used / Removed" : "Available"; }
export function timeGreeting(timeZone = "Australia/Perth", date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hourCycle: "h23", timeZone }).format(date));
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
