import { resolveAssetUrl } from "@/lib/certificate-template";

export type VideoSource =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "file"; src: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"]);

function appendStartParam(url: string, startSeconds?: number) {
  if (!startSeconds || startSeconds <= 0) return url;
  const seconds = Math.floor(startSeconds);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}start=${seconds}`;
}

function appendVimeoStart(url: string, startSeconds?: number) {
  if (!startSeconds || startSeconds <= 0) return url;
  const seconds = Math.floor(startSeconds);
  return `${url}#t=${seconds}s`;
}

function youtubeEmbed(id: string, startSeconds?: number): VideoSource {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  return { kind: "youtube", embedUrl: appendStartParam(base, startSeconds) };
}

export function resolveVideoSource(
  raw: string | null | undefined,
  startSeconds?: number,
): VideoSource | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("/uploads/")) {
    return { kind: "file", src: resolveAssetUrl(trimmed) };
  }
  if (trimmed.includes("/media/uploads/")) {
    return { kind: "file", src: trimmed };
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? youtubeEmbed(id, startSeconds) : null;
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const fromQuery = url.searchParams.get("v");
    const fromPath = url.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
    const id = fromQuery || fromPath;
    return id ? youtubeEmbed(id, startSeconds) : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter((part) => /^\d+$/.test(part)).pop();
    return id
      ? { kind: "vimeo", embedUrl: appendVimeoStart(`https://player.vimeo.com/video/${id}`, startSeconds) }
      : null;
  }

  return { kind: "file", src: raw.trim() };
}
