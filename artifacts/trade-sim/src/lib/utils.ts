import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTradeValue(value: number): string {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

export function getPositionColor(position: string): string {
  switch (position.toUpperCase()) {
    case 'QB': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
    case 'RB': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'WR': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'TE': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'D/ST': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    case 'K': return 'text-teal-400 bg-teal-400/10 border-teal-400/20';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
}

export function getVerdictColor(verdict: string): string {
  switch (verdict.toLowerCase()) {
    case 'win': return 'text-success border-success/30 bg-success/10';
    case 'loss': return 'text-destructive border-destructive/30 bg-destructive/10';
    default: return 'text-muted-foreground border-border bg-muted/30';
  }
}

export function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald-400';
  if (grade.startsWith('B')) return 'text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-400';
  if (grade.startsWith('D')) return 'text-orange-400';
  return 'text-red-500';
}

export function getGradeBg(grade: string): string {
  if (grade.startsWith('A')) return 'bg-emerald-400/10 border-emerald-400/30';
  if (grade.startsWith('B')) return 'bg-blue-400/10 border-blue-400/30';
  if (grade.startsWith('C')) return 'bg-yellow-400/10 border-yellow-400/30';
  if (grade.startsWith('D')) return 'bg-orange-400/10 border-orange-400/30';
  return 'bg-red-500/10 border-red-500/30';
}
