import path from 'node:path';
import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import { getStorage, publicPathToKey } from '../storage/driver';

export const CERTIFICATE_ASSET_KINDS = ['logo', 'signature', 'background'] as const;
export type CertificateAssetKind = (typeof CERTIFICATE_ASSET_KINDS)[number];

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

const MAX_BYTES: Record<CertificateAssetKind, number> = {
  logo: 800_000,
  signature: 800_000,
  background: 1_600_000,
};

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/;

export function uploadsRoot(): string {
  return path.resolve(process.cwd(), 'uploads');
}

export function certificateAssetDir(organizationId: string): string {
  return path.join(uploadsRoot(), 'certificates', organizationId);
}

export function parseImageDataUrl(dataUrl: string, kind: CertificateAssetKind) {
  const match = DATA_URL_RE.exec(dataUrl.trim());
  if (!match) {
    throw AppError.from('VALIDATION_ERROR', 'Upload a PNG, JPEG, or WebP image.');
  }
  const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1]!;
  const buffer = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'Image file is empty.');
  if (buffer.length > MAX_BYTES[kind]) {
    throw AppError.from('PAYLOAD_TOO_LARGE', `Image must be smaller than ${Math.round(MAX_BYTES[kind] / 1024)} KB.`);
  }
  return { mime, buffer, ext: MIME_EXT[mime] ?? 'png' };
}

export async function saveCertificateAsset(
  organizationId: string,
  kind: CertificateAssetKind,
  dataUrl: string,
): Promise<string> {
  const { buffer, ext } = parseImageDataUrl(dataUrl, kind);
  const filename = `${kind}.${ext}`;
  const publicPath = `/uploads/certificates/${organizationId}/${filename}`;
  await getStorage().put(publicPathToKey(publicPath), buffer);
  return publicPath;
}

export function publicAssetUrl(relativePath: string): string {
  const origin = env.API_PUBLIC_URL.replace(/\/$/, '');
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  if (path.startsWith('/uploads/')) {
    return `${origin}/api/v1/media${path}`;
  }
  return `${origin}${path}`;
}

export const LESSON_ASSET_KINDS = ['video', 'document'] as const;
export type LessonAssetKind = (typeof LESSON_ASSET_KINDS)[number];

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v']);
const DOCUMENT_EXTS = new Set([
  'pdf',
  'ppt',
  'pptx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'txt',
]);

export const LESSON_ASSET_MAX_BYTES: Record<LessonAssetKind, number> = {
  video: 80 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

function extFromFilename(filename: string): string {
  const base = path.basename(filename).toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).replace(/[^a-z0-9]/g, '');
}

export function isLessonAssetKind(value: string): value is LessonAssetKind {
  return (LESSON_ASSET_KINDS as readonly string[]).includes(value);
}

export async function saveLessonAsset(
  organizationId: string,
  courseId: string,
  lessonId: string,
  kind: LessonAssetKind,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = extFromFilename(filename);
  const allowed = kind === 'video' ? VIDEO_EXTS : DOCUMENT_EXTS;
  if (!allowed.has(ext)) {
    throw AppError.from(
      'VALIDATION_ERROR',
      kind === 'video'
        ? 'Upload an MP4, WebM, MOV, or M4V video.'
        : 'Upload a PDF, Office, image, or text file.',
    );
  }
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'File is empty.');
  if (buffer.length > LESSON_ASSET_MAX_BYTES[kind]) {
    const mb = Math.round(LESSON_ASSET_MAX_BYTES[kind] / (1024 * 1024));
    throw AppError.from('PAYLOAD_TOO_LARGE', `File must be smaller than ${mb} MB.`);
  }
  const stored = `${lessonId}-${kind}.${ext}`;
  const publicPath = `/uploads/lessons/${organizationId}/${courseId}/${stored}`;
  await getStorage().put(publicPathToKey(publicPath), buffer);
  return publicPath;
}

const AVATAR_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const AVATAR_MAX_BYTES = 800_000;

export function avatarDir(organizationId: string): string {
  return path.join(uploadsRoot(), 'avatars', organizationId);
}

export async function saveAvatar(
  organizationId: string,
  userId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = extFromFilename(filename);
  if (!AVATAR_EXTS.has(ext)) {
    throw AppError.from('VALIDATION_ERROR', 'Upload a PNG, JPEG, or WebP image.');
  }
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'Image is empty.');
  if (buffer.length > AVATAR_MAX_BYTES) {
    throw AppError.from('PAYLOAD_TOO_LARGE', 'Avatar must be smaller than 800 KB.');
  }
  const stored = `${userId}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const publicPath = `/uploads/avatars/${organizationId}/${stored}`;
  await getStorage().put(publicPathToKey(publicPath), buffer);
  return publicPath;
}

export async function saveCourseThumbnail(
  organizationId: string,
  courseId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = extFromFilename(filename);
  if (!AVATAR_EXTS.has(ext)) {
    throw AppError.from('VALIDATION_ERROR', 'Upload a PNG, JPEG, or WebP image.');
  }
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'Image is empty.');
  if (buffer.length > AVATAR_MAX_BYTES) {
    throw AppError.from('PAYLOAD_TOO_LARGE', 'Thumbnail must be smaller than 800 KB.');
  }
  const stored = `${courseId}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const publicPath = `/uploads/courses/${organizationId}/${stored}`;
  await getStorage().put(publicPathToKey(publicPath), buffer);
  return publicPath;
}

export async function saveCourseIntroVideo(
  organizationId: string,
  courseId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = extFromFilename(filename);
  if (!VIDEO_EXTS.has(ext)) {
    throw AppError.from('VALIDATION_ERROR', 'Upload an MP4, WebM, MOV, or M4V video.');
  }
  if (!buffer.length) throw AppError.from('VALIDATION_ERROR', 'Video is empty.');
  if (buffer.length > LESSON_ASSET_MAX_BYTES.video) {
    throw AppError.from('PAYLOAD_TOO_LARGE', 'Intro video must be smaller than 80 MB.');
  }
  const stored = `${courseId}-intro.${ext}`;
  const publicPath = `/uploads/courses/${organizationId}/${stored}`;
  await getStorage().put(publicPathToKey(publicPath), buffer);
  return publicPath;
}
