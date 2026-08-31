export function isCatalogThumbnailFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.includes('-intro.')) return false;
  return /\.(png|jpe?g|webp|gif)$/.test(lower);
}
