export function str(fd: FormData, key: string): string | null {
  const v = String(fd.get(key) ?? "").trim();
  return v === "" ? null : v;
}

export function numOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function pctOrNull(fd: FormData, key: string): number | null {
  const n = numOrNull(fd, key);
  return n === null ? null : n / 100;
}
