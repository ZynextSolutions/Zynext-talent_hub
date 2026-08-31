import fs from 'node:fs';
import path from 'node:path';
import { AppError } from '../errors/app-error';
import { prisma } from '../repositories/prisma';
import { courseRepository } from '../repositories/course.repository';
import { enrollmentRepository } from '../repositories/enrollment.repository';
import { lessonRepository } from '../repositories/lesson.repository';
import { progressRepository } from '../repositories/progress.repository';
import { courseService } from './course.service';
import { certificateService } from './certificate.service';
import { extractScormPackage } from '../lib/scorm-package';
import { assertCourseAvailableNow } from '../lib/course-availability';
import {
  assertCoursePrerequisitesMet,
  assertLessonPrerequisiteMet,
} from '../lib/course-prerequisites';
import { resolveUploadFilePath } from '../lib/media-access';
import { uploadsRoot } from '../lib/uploads';
import { toCourseDto, toLessonDto } from '../lib/mappers';
import { signScormTicket } from '../lib/scorm-ticket';
import { env } from '../config/env';
import type { AuthPrincipal } from '../types/auth';
import { clock } from '../lib/clock';
import { parseScormSessionTime, scormMinSessionSeconds } from '../lib/lesson-completion';
import { canAccessScormEnrollment, type ScormEnrollmentAccessMode } from '../lib/scorm-access';

type CmiState = Record<string, string>;

const COMPLETED_STATUSES = new Set(['completed', 'passed']);

function defaultCmiState(): CmiState {
  return {
    'cmi.core.lesson_status': 'not attempted',
    'cmi.core.lesson_location': '',
    'cmi.core.score.raw': '',
    'cmi.core.score.min': '0',
    'cmi.core.score.max': '100',
    'cmi.core.session_time': '0000:00:00',
    'cmi.suspend_data': '',
    'cmi.core.entry': 'ab-initio',
    'cmi.core.exit': '',
    'cmi.core.student_id': '',
    'cmi.core.student_name': '',
  };
}

function enrollmentToCmi(
  enrollment: {
    user: { id: string; firstName: string; lastName: string };
    scormLessonStatus: string | null;
    scormScoreRaw: number | null;
    scormSuspendData: string | null;
    scormLocation: string | null;
    scormSessionTime: string | null;
  },
): CmiState {
  const state = defaultCmiState();
  state['cmi.core.student_id'] = enrollment.user.id;
  state['cmi.core.student_name'] = `${enrollment.user.lastName}, ${enrollment.user.firstName}`;
  state['cmi.core.lesson_status'] = enrollment.scormLessonStatus ?? 'not attempted';
  state['cmi.core.lesson_location'] = enrollment.scormLocation ?? '';
  state['cmi.suspend_data'] = enrollment.scormSuspendData ?? '';
  state['cmi.core.session_time'] = enrollment.scormSessionTime ?? '0000:00:00';
  if (enrollment.scormScoreRaw !== null && enrollment.scormScoreRaw !== undefined) {
    state['cmi.core.score.raw'] = String(enrollment.scormScoreRaw);
  }
  if (enrollment.scormLessonStatus && enrollment.scormLessonStatus !== 'not attempted') {
    state['cmi.core.entry'] = 'resume';
  }
  return state;
}

class ScormService {
  async uploadPackage(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    buffer: Buffer,
  ) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const extracted = await extractScormPackage(organizationId, courseId, buffer);

    const result = await prisma.$transaction(async (tx) => {
      await tx.course.updateMany({
        where: { id: courseId, organizationId },
        data: {
          scormPackageUrl: extracted.packageUrl,
          scormVersion: extracted.version,
        },
      });

      const existingLessons = await tx.lesson.findMany({
        where: { organizationId, courseId, kind: 'SCORM' },
        orderBy: { orderIndex: 'asc' },
      });
      let lesson =
        existingLessons[0] ??
        (await tx.lesson.create({
          data: {
            organizationId,
            courseId,
            title: extracted.title,
            description: 'Imported SCORM package',
            kind: 'SCORM',
            content: '',
            resourceUrl: extracted.packageUrl,
            orderIndex: 0,
            required: true,
          },
        }));

      if (existingLessons[0]) {
        lesson = await tx.lesson.update({
          where: { id: existingLessons[0].id },
          data: {
            title: extracted.title,
            resourceUrl: extracted.packageUrl,
            kind: 'SCORM',
          },
        });
      }

      const course = await tx.course.findFirst({
        where: { id: courseId, organizationId },
        include: { _count: { select: { lessons: true } } },
      });
      return { course: course!, lesson };
    });

    return {
      course: toCourseDto(result.course, result.course._count.lessons),
      lesson: toLessonDto(result.lesson),
      launchUrl: extracted.packageUrl,
      scormVersion: extracted.version,
    };
  }

  async getLaunch(organizationId: string, enrollmentId: string, actor: AuthPrincipal) {
    const enrollment = await this.assertEnrollmentAccess(organizationId, enrollmentId, actor, 'read');
    const course = await courseRepository.getById(organizationId, enrollment.courseId);
    if (!course?.scormPackageUrl) {
      throw AppError.from('VALIDATION_ERROR', 'This course has no SCORM package.');
    }
    const scormLesson = (await lessonRepository.listByCourse(organizationId, enrollment.courseId)).find(
      (row) => row.kind === 'SCORM',
    );
    if (scormLesson) {
      const progressRows = await progressRepository.listByEnrollment(enrollmentId);
      const completedLessonIds = new Set(
        progressRows.filter((entry) => entry.completed).map((entry) => entry.lessonId),
      );
      assertLessonPrerequisiteMet(scormLesson, completedLessonIds);
    }
    const ticket = signScormTicket(
      {
        sub: actor.sub,
        organizationId,
        enrollmentId,
      },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_TTL_SEC,
    );
    const apiBase = `/api/v1/learn/scorm/${enrollmentId}`;
    const contentUrl = course.scormPackageUrl;
    return {
      playerUrl: `${apiBase}/player?ticket=${encodeURIComponent(ticket)}`,
      contentUrl,
      scormVersion: course.scormVersion ?? '1.2',
      stateUrl: `${apiBase}/state`,
      commitUrl: `${apiBase}/commit`,
    };
  }

  async getState(organizationId: string, enrollmentId: string, actor: AuthPrincipal) {
    const enrollment = await this.assertEnrollmentAccess(organizationId, enrollmentId, actor, 'read');
    return enrollmentToCmi(enrollment);
  }

  async commit(
    organizationId: string,
    enrollmentId: string,
    actor: AuthPrincipal,
    values: CmiState,
    finished = false,
  ) {
    const enrollment = await this.assertEnrollmentAccess(organizationId, enrollmentId, actor, 'write');
    const lessonStatus = values['cmi.core.lesson_status']?.toLowerCase() ?? enrollment.scormLessonStatus ?? 'not attempted';
    const scoreRaw = values['cmi.core.score.raw'];
    const parsedScore = scoreRaw && scoreRaw !== '' ? Number(scoreRaw) : null;

    return prisma.$transaction(async (tx) => {
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          scormLessonStatus: lessonStatus,
          scormScoreRaw: parsedScore,
          scormSuspendData: values['cmi.suspend_data'] ?? enrollment.scormSuspendData,
          scormLocation: values['cmi.core.lesson_location'] ?? enrollment.scormLocation,
          scormSessionTime: values['cmi.core.session_time'] ?? enrollment.scormSessionTime,
        },
      });

      const scormLesson = await tx.lesson.findFirst({
        where: { organizationId, courseId: enrollment.courseId, kind: 'SCORM' },
        orderBy: { orderIndex: 'asc' },
      });

      let certificate = null;
      const wantsComplete = COMPLETED_STATUSES.has(lessonStatus);
      const sessionSeconds = parseScormSessionTime(
        values['cmi.core.session_time'] ?? enrollment.scormSessionTime,
      );
      const minSession = scormMinSessionSeconds(scormLesson?.durationSeconds);
      const completed = wantsComplete && sessionSeconds >= minSession;
      if (finished && wantsComplete && !completed) {
        throw AppError.from(
          'LESSON_COMPLETION_NOT_READY',
          `SCORM session time must be at least ${minSession} seconds before completion.`,
        );
      }
      if (scormLesson) {
        await progressRepository.withTx(tx).upsertLesson(enrollmentId, scormLesson.id, {
          completed,
          percentage: completed ? 100 : 0,
          completedAt: completed ? clock.now() : null,
        });
      }

      if (completed) {
        await enrollmentRepository.withTx(tx).update(organizationId, enrollmentId, {
          progressPct: 100,
          status: 'COMPLETED',
          completedAt: clock.now(),
        });
        certificate = await certificateService.issueIfEligible(organizationId, enrollmentId, tx);
      } else if (enrollment.status === 'ENROLLED') {
        await enrollmentRepository.withTx(tx).update(organizationId, enrollmentId, {
          status: 'IN_PROGRESS',
        });
      }

      return {
        committed: true,
        finished,
        lessonStatus,
        certificate,
      };
    });
  }

  renderPlayerHtml(enrollmentId: string, contentPath: string): string {
    const launchRelative = scormLaunchRelativePath(contentPath);
    const contentUrl = `/api/v1/learn/scorm/${enrollmentId}/content/${launchRelative}`;
    const stateUrl = `/api/v1/learn/scorm/${enrollmentId}/state`;
    const commitUrl = `/api/v1/learn/scorm/${enrollmentId}/commit`;
    const finishUrl = `/api/v1/learn/scorm/${enrollmentId}/finish`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCORM Player</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0f172a; }
    iframe { border: 0; width: 100%; height: 100%; background: #fff; }
    #status { position: fixed; inset: 0; display: grid; place-items: center; color: #e2e8f0; font: 14px system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="status">Loading SCORM content…</div>
  <iframe id="sco" title="SCORM content" hidden sandbox="allow-scripts allow-forms allow-popups allow-downloads"></iframe>
  <script>
    const stateUrl = ${JSON.stringify(stateUrl)};
    const commitUrl = ${JSON.stringify(commitUrl)};
    const finishUrl = ${JSON.stringify(finishUrl)};
    const contentUrl = ${JSON.stringify(contentUrl)};

    let cache = {};
    let initialized = false;
    let finished = false;

    async function loadState() {
      const res = await fetch(stateUrl, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load SCORM state');
      cache = await res.json();
    }

    async function persist(values, url) {
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      });
    }

    function errorCode() { return '0'; }

    const API = {
      LMSInitialize: function () {
        if (initialized || finished) return 'false';
        initialized = true;
        return 'true';
      },
      LMSFinish: function () {
        if (!initialized || finished) return 'false';
        finished = true;
        void persist(cache, finishUrl);
        return 'true';
      },
      LMSGetValue: function (element) {
        if (!initialized || finished) return '';
        return cache[element] ?? '';
      },
      LMSSetValue: function (element, value) {
        if (!initialized || finished) return 'false';
        cache[element] = String(value ?? '');
        return 'true';
      },
      LMSCommit: function () {
        if (!initialized || finished) return 'false';
        void persist(cache, commitUrl);
        return 'true';
      },
      LMSGetLastError: function () { return errorCode(); },
      LMSGetErrorString: function () { return 'No error'; },
      LMSGetDiagnostic: function () { return 'No error'; },
    };

    window.API = API;

    loadState()
      .then(function () {
        document.getElementById('status').style.display = 'none';
        const frame = document.getElementById('sco');
        frame.hidden = false;
        frame.src = contentUrl;
      })
      .catch(function (err) {
        document.getElementById('status').textContent = err.message || 'Failed to load SCORM content.';
      });
  </script>
</body>
</html>`;
  }

  scormContentCookiePath(enrollmentId: string): string {
    return `/api/v1/learn/scorm/${enrollmentId}`;
  }

  scormPreviewContentCookiePath(courseId: string): string {
    return `/api/v1/learn/scorm/preview/${courseId}`;
  }

  async getPreviewLaunch(organizationId: string, courseId: string, actor: AuthPrincipal) {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const course = await courseRepository.getById(organizationId, courseId);
    if (!course?.scormPackageUrl) {
      throw AppError.from('VALIDATION_ERROR', 'This course has no SCORM package.');
    }
    const ticket = signScormTicket(
      {
        sub: actor.sub,
        organizationId,
        courseId,
      },
      env.JWT_ACCESS_SECRET,
      env.JWT_ACCESS_TTL_SEC,
    );
    const apiBase = `/api/v1/learn/scorm/preview/${courseId}`;
    return {
      playerUrl: `${apiBase}/player?ticket=${encodeURIComponent(ticket)}`,
      contentUrl: course.scormPackageUrl,
      scormVersion: course.scormVersion ?? '1.2',
    };
  }

  renderPreviewPlayerHtml(courseId: string, contentPath: string): string {
    const launchRelative = scormLaunchRelativePath(contentPath);
    const contentUrl = `/api/v1/learn/scorm/preview/${courseId}/content/${launchRelative}`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SCORM Preview</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0f172a; }
    iframe { border: 0; width: 100%; height: 100%; background: #fff; }
  </style>
</head>
<body>
  <iframe id="sco" title="SCORM preview" src="" sandbox="allow-scripts allow-forms allow-popups allow-downloads"></iframe>
  <script>
    const contentUrl = ${JSON.stringify(contentUrl)};
    document.getElementById('sco').src = contentUrl;
  </script>
</body>
</html>`;
  }

  async servePreviewContentFile(
    organizationId: string,
    courseId: string,
    actor: AuthPrincipal,
    relativePath: string,
  ): Promise<{ filePath: string; contentType: string | null }> {
    await courseService.assertCanWrite(organizationId, courseId, actor);
    const course = await courseRepository.getById(organizationId, courseId);
    if (!course?.scormPackageUrl) {
      throw AppError.from('NOT_FOUND', 'This course has no SCORM package.');
    }

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw AppError.from('NOT_FOUND');
    }

    const packagePrefix = `/uploads/scorm/${organizationId}/${courseId}/`;
    const uploadPath = `${packagePrefix}${normalized}`;
    const abs = resolveUploadFilePath(uploadPath, uploadsRoot());
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      throw AppError.from('NOT_FOUND');
    }

    return { filePath: abs, contentType: contentTypeForPath(normalized) };
  }

  async serveContentFile(
    organizationId: string,
    enrollmentId: string,
    actor: AuthPrincipal,
    relativePath: string,
  ): Promise<{ filePath: string; contentType: string | null }> {
    const enrollment = await this.assertEnrollmentAccess(organizationId, enrollmentId, actor, 'read');
    const course = await courseRepository.getById(organizationId, enrollment.courseId);
    if (!course?.scormPackageUrl) {
      throw AppError.from('NOT_FOUND', 'This course has no SCORM package.');
    }

    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) {
      throw AppError.from('NOT_FOUND');
    }

    const packagePrefix = `/uploads/scorm/${organizationId}/${enrollment.courseId}/`;
    const uploadPath = `${packagePrefix}${normalized}`;
    const abs = resolveUploadFilePath(uploadPath, uploadsRoot());
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      throw AppError.from('NOT_FOUND');
    }

    return { filePath: abs, contentType: contentTypeForPath(normalized) };
  }

  private async assertEnrollmentAccess(
    organizationId: string,
    enrollmentId: string,
    actor: AuthPrincipal,
    mode: ScormEnrollmentAccessMode,
  ) {
    const enrollment = await enrollmentRepository.getById(organizationId, enrollmentId);
    if (!enrollment) throw AppError.from('NOT_FOUND');
    if (!canAccessScormEnrollment(enrollment.userId, actor, mode)) {
      throw AppError.from('RBAC_FORBIDDEN');
    }
    if (enrollment.status === 'REVOKED') throw AppError.from('RBAC_FORBIDDEN');
    const course = await courseRepository.getById(organizationId, enrollment.courseId);
    if (course) assertCourseAvailableNow(course);
    if (enrollment.userId === actor.sub) {
      await assertCoursePrerequisitesMet(organizationId, actor.sub, enrollment.courseId);
    }
    const withUser = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, organizationId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!withUser) throw AppError.from('NOT_FOUND');
    return withUser;
  }
}

export const scormService = new ScormService();

function scormLaunchRelativePath(contentPath: string): string {
  const normalized = contentPath.startsWith('/') ? contentPath : `/${contentPath}`;
  const marker = '/uploads/scorm/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) {
    return normalized.replace(/^\/+/, '');
  }
  const tail = normalized.slice(idx + marker.length);
  const parts = tail.split('/').filter(Boolean);
  // uploads/scorm/{orgId}/{courseId}/…package files…
  return parts.length > 2 ? parts.slice(2).join('/') : tail;
}

function contentTypeForPath(relativePath: string): string | null {
  const ext = path.extname(relativePath).toLowerCase();
  switch (ext) {
    case '.html':
    case '.htm':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.xml':
      return 'application/xml; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.mp3':
      return 'audio/mpeg';
    case '.mp4':
      return 'video/mp4';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    default:
      return null;
  }
}
