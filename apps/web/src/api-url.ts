export function resolveApiUrl(path: string, baseUrl?: string): string {
  if (!baseUrl?.trim()) return path;
  const base = baseUrl.trim().replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}
