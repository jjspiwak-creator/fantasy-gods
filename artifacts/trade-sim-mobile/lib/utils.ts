export function getGradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#22ba5a";
  if (grade === "B+" || grade === "B") return "#08d4f0";
  if (grade === "B-" || grade === "C+") return "#7c5cbf";
  if (grade === "C" || grade === "C-") return "#f59e0b";
  return "#d9243a";
}

export function getGradeBorderColor(grade: string): string {
  if (grade.startsWith("A")) return "#22ba5a50";
  if (grade === "B+" || grade === "B") return "#08d4f050";
  if (grade === "B-" || grade === "C+") return "#7c5cbf50";
  if (grade === "C" || grade === "C-") return "#f59e0b50";
  return "#d9243a50";
}

export function getGradeBgColor(grade: string): string {
  if (grade.startsWith("A")) return "#22ba5a15";
  if (grade === "B+" || grade === "B") return "#08d4f015";
  if (grade === "B-" || grade === "C+") return "#7c5cbf15";
  if (grade === "C" || grade === "C-") return "#f59e0b15";
  return "#d9243a15";
}

export function formatTradeValue(val: number): string {
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toFixed(1)}`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function isStale(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 60 * 60 * 1000;
}
