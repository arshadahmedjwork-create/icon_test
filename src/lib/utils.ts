import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanCertificateName(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  const words = trimmed.split(/\s+/);
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(" ");
    const secondHalf = words.slice(half).join(" ");
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      return words.slice(0, half).join(" ");
    }
  }
  return trimmed;
}

