export async function fileToCompressedDataUrl(
  file: File,
  options: { maxEdge: number; quality?: number },
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, options.maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, options.quality ?? 0.82);
}
