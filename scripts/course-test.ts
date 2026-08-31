/**
 * Course management integration smoke tests.
 * Usage: npx tsx scripts/course-test.ts
 */

import AdmZip from 'adm-zip';

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

type Env<T> = { success: true; data: T } | { success: false; error: { message: string; code?: string } };

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; idempotencyKey?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: T | null; err?: string; code?: string }> {
  if (
    method === 'POST' &&
    opts.token &&
    /\/enrollments\/[^/]+\/progress\/lessons\/[^/]+\/complete$/.test(path)
  ) {
    const visitPath = path.replace(/\/complete$/, '');
    await fetch(`${API}${visitPath}`, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ positionSeconds: 0 }),
    });
  }
  const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: Env<T> | null = null;
  try {
    json = JSON.parse(text) as Env<T>;
  } catch {
    /* raw */
  }
  if (!res.ok || (json && 'success' in json && !json.success)) {
    const err =
      json && 'error' in json ? json.error.message : text.slice(0, 160) || `HTTP ${res.status}`;
    const code = json && 'error' in json ? json.error.code : undefined;
    return { status: res.status, data: null, err, code };
  }
  if (json && 'data' in json) return { status: res.status, data: json.data, err: undefined };
  return { status: res.status, data: text as unknown as T, err: undefined };
}

async function login(email: string, password: string, organizationSlug: string) {
  return api<{ tokens?: { accessToken: string } }>('POST', '/auth/login', {
    body: { email, password, organizationSlug },
  });
}

function createTestScormZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    'imsmanifest.xml',
    Buffer.from(`<?xml version="1.0"?>
<manifest identifier="MANIFEST" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>Test SCORM</title>
      <item identifier="ITEM" identifierref="RES" isvisible="true"><title>Test</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`),
  );
  zip.addFile(
    'index.html',
    Buffer.from(`<!DOCTYPE html><html><body><p>SCORM test content</p></body></html>`),
  );
  return zip.toBuffer();
}

async function uploadScorm(token: string, courseId: string) {
  const res = await fetch(`${API}/courses/${courseId}/scorm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent('test-scorm.zip'),
    },
    body: createTestScormZip(),
  });
  const text = await res.text();
  let json: Env<{ launchUrl: string; scormVersion: string; lesson: { id: string } }> | null = null;
  try {
    json = JSON.parse(text) as Env<{ launchUrl: string; scormVersion: string; lesson: { id: string } }>;
  } catch {
    /* raw */
  }
  if (!res.ok || (json && 'success' in json && !json.success)) {
    const err = json && 'error' in json ? json.error.message : text.slice(0, 160);
    return { data: null, err };
  }
  return { data: json && 'data' in json ? json.data : null, err: undefined };
}

async function uploadIntroVideo(token: string, courseId: string) {
  const res = await fetch(`${API}/courses/${courseId}/intro-video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent('intro.mp4'),
    },
    body: Buffer.from('test-intro-video'),
  });
  const text = await res.text();
  let json: Env<{ videoUrl?: string }> | null = null;
  try {
    json = JSON.parse(text) as Env<{ videoUrl?: string }>;
  } catch {
    /* raw */
  }
  if (!res.ok || (json && 'success' in json && !json.success)) {
    const err = json && 'error' in json ? json.error.message : text.slice(0, 160);
    return { data: null, err };
  }
  return { data: json && 'data' in json ? json.data : null, err: undefined };
}

async function uploadLessonAsset(token: string, lessonId: string, kind: 'document' | 'video') {
  const filename = kind === 'video' ? 'clip.mp4' : 'handout.pdf';
  const res = await fetch(`${API}/lessons/${lessonId}/asset`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent(filename),
      'X-Asset-Kind': kind,
    },
    body: Buffer.from(kind === 'video' ? 'test-video-bytes' : '%PDF-1.4 test'),
  });
  const text = await res.text();
  let json: Env<{ lesson?: { resourceUrl?: string | null; videoUrl?: string | null } }> | null = null;
  try {
    json = JSON.parse(text) as Env<{ lesson?: { resourceUrl?: string | null; videoUrl?: string | null } }>;
  } catch {
    /* raw */
  }
  if (!res.ok || (json && 'success' in json && !json.success)) {
    const err = json && 'error' in json ? json.error.message : text.slice(0, 160);
    return { data: null, err };
  }
  return { data: json && 'data' in json ? json.data : null, err: undefined };
}

async function main() {
  console.log('\nCourse Management Tests\n');

  try {
    const health = await fetch(`${API.replace('/api/v1', '')}/health`);
    if (!health.ok) {
      console.error('API is not healthy. Start the backend first: npm run dev:api');
      process.exit(1);
    }
  } catch {
    console.error(`Cannot reach API at ${API.replace('/api/v1', '')}. Start: npm run dev:api`);
    process.exit(1);
  }

  const adminLogin = await login('admin@acme.com', 'Password123!', 'acme');
  record('Org admin login', !!adminLogin.data?.tokens?.accessToken, adminLogin.err);
  const token = adminLogin.data?.tokens?.accessToken;
  if (!token) {
    console.log('\nAborting — seed admin login failed.\n');
    process.exit(1);
  }

  const me = await api<{ organization?: { id: string } }>('GET', '/auth/me', { token });
  const orgId = me.data?.organization?.id;

  const publicUpload = await fetch(`${API.replace('/api/v1', '')}/uploads/lessons/test/test/test.mp4`);
  record('Public /uploads blocked', publicUpload.status === 403, `status ${publicUpload.status}`);

  const created = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Course test ${Date.now()}`, description: 'Automated test course' },
  });
  record('Create draft course', !!created.data?.id, created.err);
  const courseId = created.data?.id;
  if (!courseId) {
    console.log('\nAborting — could not create course.\n');
    process.exit(1);
  }

  const lesson = await api<{ id: string }>('POST', `/courses/${courseId}/lessons`, {
    token,
    body: { title: 'Intro lesson', kind: 'READING', content: 'Hello', required: true },
  });
  record('Create lesson with required flag', !!lesson.data?.id, lesson.err);

  const archivedPatch = await api('PATCH', `/courses/${courseId}`, {
    token,
    body: { title: 'Should fail after archive' },
  });
  await api('POST', `/courses/${courseId}/archive`, { token });
  const archivedWrite = await api('PATCH', `/courses/${courseId}`, {
    token,
    body: { title: 'Blocked while archived' },
  });
  record('Archived course rejects writes', archivedWrite.code === 'COURSE_ARCHIVED', archivedWrite.err);

  const unarchived = await api<{ status: string }>('POST', `/courses/${courseId}/unarchive`, { token });
  record('Unarchive course', unarchived.data?.status === 'DRAFT', unarchived.err);

  const catalog = await api<{ items?: Array<{ catalogAvailability?: string; enrolled?: boolean }> }>(
    'GET',
    '/courses/catalog?pageSize=5',
    { token },
  );
  record(
    'Catalog endpoint',
    Array.isArray(catalog.data?.items) &&
      (catalog.data.items.length === 0 ||
        (catalog.data.items[0]?.catalogAvailability !== undefined &&
          catalog.data.items[0]?.enrolled !== undefined)),
    catalog.err,
  );

  const dueCatalogCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Due date catalog ${Date.now()}`, description: 'Catalog due metadata' },
  });
  record('Create course for catalog due date', !!dueCatalogCourse.data?.id, dueCatalogCourse.err);
  if (dueCatalogCourse.data?.id) {
    await api('POST', `/courses/${dueCatalogCourse.data.id}/lessons`, {
      token,
      body: { title: 'Lesson', kind: 'READING', content: 'Due test' },
    });
    await api('POST', `/courses/${dueCatalogCourse.data.id}/publish`, { token });
    const catalogUsers = await api<{ items: Array<{ id: string; email: string }> }>(
      'GET',
      '/users?pageSize=20',
      { token },
    );
    const catalogAliceId = catalogUsers.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
    if (catalogAliceId) {
      const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await api('POST', `/courses/${dueCatalogCourse.data.id}/assign`, {
        token,
        body: { targetType: 'USER', targetId: catalogAliceId, dueAt },
        idempotencyKey: `due-catalog-${dueCatalogCourse.data.id}`,
      });
      const aliceCatalogLogin = await login('alice@acme.com', 'Password123!', 'acme');
      const aliceCatalogToken = aliceCatalogLogin.data?.tokens?.accessToken;
      if (aliceCatalogToken) {
        const aliceCatalog = await api<{
          items: Array<{ id: string; enrolled?: boolean; dueAt?: string | null; isDueSoon?: boolean }>;
        }>('GET', '/courses/catalog?pageSize=50', { token: aliceCatalogToken });
        const catalogRow = aliceCatalog.data?.items?.find((row) => row.id === dueCatalogCourse.data!.id);
        record(
          'Catalog includes enrollment due date',
          !!catalogRow?.enrolled && !!catalogRow?.dueAt && catalogRow.isDueSoon === true,
          catalogRow?.dueAt ?? 'missing dueAt',
        );

        const enrolledOnly = await api<{
          items: Array<{ id: string; enrolled?: boolean }>;
        }>('GET', `/courses/catalog?enrolled=true&pageSize=50`, { token: aliceCatalogToken });
        record(
          'Catalog enrolled filter',
          Array.isArray(enrolledOnly.data?.items) &&
            enrolledOnly.data.items.every((row) => row.enrolled === true),
          `count ${enrolledOnly.data?.items?.length ?? 'n/a'}`,
        );

        const openOnly = await api<{
          items: Array<{ catalogAvailability?: string }>;
        }>('GET', '/courses/catalog?availability=open&pageSize=50', { token: aliceCatalogToken });
        record(
          'Catalog availability filter',
          Array.isArray(openOnly.data?.items) &&
            openOnly.data.items.every((row) => row.catalogAvailability === 'open'),
          `count ${openOnly.data?.items?.length ?? 'n/a'}`,
        );

        const favoriteAdd = await api<{ favorited?: boolean }>(
          'POST',
          `/courses/${dueCatalogCourse.data!.id}/favorite`,
          { token: aliceCatalogToken },
        );
        record('Add course favorite', favoriteAdd.data?.favorited === true, favoriteAdd.err);

        const favoritedCatalog = await api<{
          items: Array<{ id: string; favorited?: boolean }>;
        }>('GET', '/courses/catalog?pageSize=50', { token: aliceCatalogToken });
        const favoritedRow = favoritedCatalog.data?.items?.find(
          (row) => row.id === dueCatalogCourse.data!.id,
        );
        record('Catalog shows favorited course', favoritedRow?.favorited === true, favoriteAdd.err);

        const favoriteRemove = await api<{ favorited?: boolean }>(
          'DELETE',
          `/courses/${dueCatalogCourse.data!.id}/favorite`,
          { token: aliceCatalogToken },
        );
        record('Remove course favorite', favoriteRemove.data?.favorited === false, favoriteRemove.err);
      }
    }
    await api('DELETE', `/courses/${dueCatalogCourse.data.id}?force=true`, { token });
  }

  if (orgId) {
    const reminderCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Reminder job ${Date.now()}`, description: 'Due reminder integration' },
    });
    if (reminderCourse.data?.id) {
      await api('POST', `/courses/${reminderCourse.data.id}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'Reminder' },
      });
      await api('POST', `/courses/${reminderCourse.data.id}/publish`, { token });
      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=50', {
        token,
      });
      const aliceReminderId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      if (aliceReminderId) {
        const assignResult = await api<{ enrolledCount?: number }>('POST', `/courses/${reminderCourse.data.id}/assign`, {
          token,
          idempotencyKey: `reminder-assign-${reminderCourse.data.id}`,
          body: {
            targetType: 'USER',
            targetId: aliceReminderId,
            dueAt,
            reminderDaysBefore: 7,
          },
        });
        record(
          'Assign course for reminder test',
          assignResult.status === 201 && (assignResult.data?.enrolledCount ?? 0) >= 1,
          assignResult.err ?? `enrolled ${assignResult.data?.enrolledCount ?? 0}`,
        );
        const aliceReminderLogin = await login('alice@acme.com', 'Password123!', 'acme');
        const aliceReminderToken = aliceReminderLogin.data?.tokens?.accessToken;
        if (aliceReminderToken) {
          const assignedNotifs = await api<{ items: Array<{ kind?: string }> }>(
            'GET',
            '/notifications?pageSize=20',
            { token: aliceReminderToken },
          );
          record(
            'Assignment creates in-app notification',
            assignedNotifs.data?.items.some((row) => row.kind === 'ASSIGNED') === true,
            assignedNotifs.err ?? `count ${assignedNotifs.data?.items?.length ?? 0}`,
          );
        }

        const jobHeaders = { 'X-Job-Secret': 'dev-job-secret' };
        const jobOnce = await api<{ dueRemindersSent?: number }>(
          'POST',
          `/jobs/reminders?organizationId=${orgId}`,
          { headers: jobHeaders },
        );
        record(
          'Reminder job sends due reminders',
          (jobOnce.data?.dueRemindersSent ?? 0) >= 1,
          jobOnce.err ?? `sent ${jobOnce.data?.dueRemindersSent ?? 0}`,
        );

        if (aliceReminderToken) {
          const dueNotifs = await api<{ items: Array<{ kind?: string }> }>(
            'GET',
            '/notifications?pageSize=20',
            { token: aliceReminderToken },
          );
          record(
            'Learner receives due reminder notification',
            dueNotifs.data?.items.some((row) => row.kind === 'DUE_REMINDER') === true,
            'missing DUE_REMINDER',
          );
        }

        const jobTwice = await api<{ dueRemindersSent?: number }>(
          'POST',
          `/jobs/reminders?organizationId=${orgId}`,
          { headers: jobHeaders },
        );
        record(
          'Reminder job is idempotent for same day',
          jobTwice.data?.dueRemindersSent === 0,
          jobTwice.err ?? `sent ${jobTwice.data?.dueRemindersSent ?? 'n/a'}`,
        );
      }
      await api('DELETE', `/courses/${reminderCourse.data.id}?force=true`, { token });
    }
  }

  const enableSelfEnroll = await api('PATCH', '/organizations/current', {
    token,
    body: { settings: { allowSelfEnrollment: true } },
  });
  record('Enable self-enrollment setting', enableSelfEnroll.status === 200, enableSelfEnroll.err);

  const catalogCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Catalog enroll ${Date.now()}`, description: 'Self-enroll test' },
  });
  const catalogCourseId = catalogCourse.data?.id;
  if (catalogCourseId) {
    await api('POST', `/courses/${catalogCourseId}/lessons`, {
      token,
      body: { title: 'Lesson', kind: 'READING', content: 'Hi' },
    });
    await api('POST', `/courses/${catalogCourseId}/publish`, { token });

    const upcomingCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Upcoming catalog ${Date.now()}`, description: 'Future availability' },
    });
    const upcomingCourseId = upcomingCourse.data?.id;
    if (upcomingCourseId) {
      await api('POST', `/courses/${upcomingCourseId}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'Soon' },
      });
      const futureFrom = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await api('PATCH', `/courses/${upcomingCourseId}`, {
        token,
        body: { availableFrom: futureFrom },
      });
      await api('POST', `/courses/${upcomingCourseId}/publish`, { token });

      const upcomingCatalog = await api<{
        items: Array<{ id: string; catalogAvailability: string }>;
      }>('GET', `/courses/catalog?q=${encodeURIComponent('Upcoming catalog')}`, { token });
      const upcomingRow = upcomingCatalog.data?.items.find((c) => c.id === upcomingCourseId);
      record('Catalog shows upcoming course', upcomingRow?.catalogAvailability === 'upcoming', upcomingRow?.catalogAvailability);

      const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
      const aliceToken = aliceLogin.data?.tokens?.accessToken;
      if (aliceToken) {
        const upcomingEnroll = await api('POST', `/courses/${upcomingCourseId}/enroll`, {
          token: aliceToken,
        });
        record(
          'Self-enroll blocked before available date',
          upcomingEnroll.code === 'COURSE_NOT_YET_AVAILABLE',
          upcomingEnroll.err,
        );

        const selfEnroll = await api<{ created?: boolean; enrollment?: { id: string } }>(
          'POST',
          `/courses/${catalogCourseId}/enroll`,
          { token: aliceToken },
        );
        record('Self-enroll open course', selfEnroll.status === 201 && !!selfEnroll.data?.enrollment?.id, selfEnroll.err);

        const repeatEnroll = await api<{ created?: boolean }>('POST', `/courses/${catalogCourseId}/enroll`, {
          token: aliceToken,
        });
        record('Self-enroll is idempotent', repeatEnroll.data?.created === false, repeatEnroll.err);

        await api('PATCH', '/organizations/current', {
          token,
          body: { settings: { allowSelfEnrollment: false } },
        });
        const blockedCourse = await api<{ id: string }>('POST', '/courses', {
          token,
          body: { title: `Blocked enroll ${Date.now()}`, description: 'Should not enroll' },
        });
        if (blockedCourse.data?.id) {
          const blockedCourseId = blockedCourse.data.id;
          await api('POST', `/courses/${blockedCourseId}/lessons`, {
            token,
            body: { title: 'Lesson', kind: 'READING', content: 'No' },
          });
          await api('POST', `/courses/${blockedCourseId}/publish`, { token });
          const denied = await api('POST', `/courses/${blockedCourseId}/enroll`, { token: aliceToken });
          record('Self-enroll respects org setting', denied.code === 'RBAC_FORBIDDEN', denied.err);
          await api('DELETE', `/courses/${blockedCourseId}?force=true`, { token });
        }

        await api('PATCH', '/organizations/current', {
          token,
          body: { settings: { allowSelfEnrollment: true } },
        });
      } else {
        record('Employee login for catalog tests', false, aliceLogin.err);
      }

      await api('DELETE', `/courses/${upcomingCourseId}?force=true`, { token });
    }

    await api('DELETE', `/courses/${catalogCourseId}?force=true`, { token });
  } else {
    record('Create catalog test course', false, catalogCourse.err);
  }

  const prereqA = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Prereq A ${Date.now()}`, description: 'Foundation course' },
  });
  const prereqAId = prereqA.data?.id;
  if (prereqAId) {
    const lessonA = await api<{ id: string }>('POST', `/courses/${prereqAId}/lessons`, {
      token,
      body: { title: 'Intro', kind: 'READING', content: 'Basics' },
    });
    await api('POST', `/courses/${prereqAId}/publish`, { token });

    const prereqB = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Prereq B ${Date.now()}`, description: 'Advanced course' },
    });
    const prereqBId = prereqB.data?.id;
    if (prereqBId) {
      await api('POST', `/courses/${prereqBId}/lessons`, {
        token,
        body: { title: 'Advanced', kind: 'READING', content: 'More' },
      });
      const setPrereqs = await api<Array<{ id: string }>>('PUT', `/courses/${prereqBId}/prerequisites`, {
        token,
        body: { prerequisiteCourseIds: [prereqAId] },
      });
      record('Set course prerequisites', setPrereqs.status === 200 && Array.isArray(setPrereqs.data), setPrereqs.err);

      const cycle = await api('PUT', `/courses/${prereqAId}/prerequisites`, {
        token,
        body: { prerequisiteCourseIds: [prereqBId] },
      });
      record('Reject circular prerequisites', cycle.status === 400, cycle.err);

      await api('POST', `/courses/${prereqBId}/publish`, { token });

      const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
      const aliceToken = aliceLogin.data?.tokens?.accessToken;
      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      if (aliceToken && lessonA.data?.id && aliceId) {
        const blockedEnroll = await api('POST', `/courses/${prereqBId}/enroll`, { token: aliceToken });
        record(
          'Self-enroll blocked by course prerequisite',
          blockedEnroll.code === 'COURSE_PREREQUISITES_NOT_MET',
          blockedEnroll.err,
        );

        const enrollA = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `prereq-a-${prereqAId}`,
          body: { userId: aliceId, courseId: prereqAId },
        });
        const enrollAId = enrollA.data?.id;
        if (enrollAId) {
          await api('POST', `/enrollments/${enrollAId}/progress/lessons/${lessonA.data.id}/complete`, {
            token: aliceToken,
          });
          const allowedEnroll = await api('POST', `/courses/${prereqBId}/enroll`, { token: aliceToken });
          record(
            'Self-enroll allowed after prerequisite completed',
            allowedEnroll.status === 201,
            allowedEnroll.err,
          );
        }

        const lessonCourse = await api<{ id: string }>('POST', '/courses', {
          token,
          body: { title: `Lesson prereq ${Date.now()}`, description: 'Lesson gating' },
        });
        const lessonCourseId = lessonCourse.data?.id;
        if (lessonCourseId) {
          const l1 = await api<{ id: string }>('POST', `/courses/${lessonCourseId}/lessons`, {
            token,
            body: { title: 'Lesson 1', kind: 'READING', content: 'One' },
          });
          const l2 = await api<{ id: string }>('POST', `/courses/${lessonCourseId}/lessons`, {
            token,
            body: { title: 'Lesson 2', kind: 'READING', content: 'Two' },
          });
          if (l1.data?.id && l2.data?.id) {
            await api('PATCH', `/lessons/${l2.data.id}`, {
              token,
              body: { prerequisiteLessonId: l1.data.id },
            });
            await api('POST', `/courses/${lessonCourseId}/publish`, { token });
            const enrollLesson = await api<{ id: string }>('POST', '/enrollments', {
              token,
              idempotencyKey: `lesson-prereq-${lessonCourseId}`,
              body: { userId: aliceId, courseId: lessonCourseId },
            });
            const lessonEnrollId = enrollLesson.data?.id;
            if (lessonEnrollId) {
              const blockedLesson = await api(
                'POST',
                `/enrollments/${lessonEnrollId}/progress/lessons/${l2.data.id}/complete`,
                { token: aliceToken },
              );
              record(
                'Lesson progress blocked by prerequisite',
                blockedLesson.code === 'LESSON_PREREQUISITE_NOT_MET',
                blockedLesson.err,
              );
              await api('POST', `/enrollments/${lessonEnrollId}/progress/lessons/${l1.data.id}/complete`, {
                token: aliceToken,
              });
              const allowedLesson = await api(
                'POST',
                `/enrollments/${lessonEnrollId}/progress/lessons/${l2.data.id}/complete`,
                { token: aliceToken },
              );
              record(
                'Lesson progress allowed after prerequisite',
                allowedLesson.status === 200,
                allowedLesson.err,
              );

              const resumePosition = await api('PUT', `/enrollments/${lessonEnrollId}/progress/lessons/${l1.data.id}`, {
                token: aliceToken,
                body: { completed: false, positionSeconds: 42 },
              });
              record('Save lesson resume position', resumePosition.status === 200, resumePosition.err);

              const resumeDetail = await api<{ lastLessonId?: string | null }>(
                'GET',
                `/enrollments/${lessonEnrollId}`,
                { token: aliceToken },
              );
              record(
                'Enrollment stores last visited lesson',
                resumeDetail.data?.lastLessonId === l1.data.id,
                resumeDetail.data?.lastLessonId ?? 'missing',
              );
            }
          }
          await api('DELETE', `/courses/${lessonCourseId}?force=true`, { token });
        }
      } else {
        record('Prerequisite learner setup', false, 'Missing alice token or lesson');
      }

      await api('DELETE', `/courses/${prereqBId}?force=true`, { token });
    }
    await api('DELETE', `/courses/${prereqAId}?force=true`, { token });
  } else {
    record('Create prerequisite course A', false, prereqA.err);
  }

  const path = await api<{ id: string }>('POST', '/learning-paths', {
    token,
    body: { title: `Path test ${Date.now()}`, description: 'Test path' },
  });
  record('Create learning path', !!path.data?.id, path.err);
  if (path.data?.id) {
    const pathCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Path course ${Date.now()}`, description: 'For path assign' },
    });
    const pathCourseId = pathCourse.data?.id;
    if (pathCourseId) {
      await api('POST', `/courses/${pathCourseId}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'Path' },
      });
      await api('POST', `/courses/${pathCourseId}/publish`, { token });
      await api('PUT', `/learning-paths/${path.data.id}/courses`, {
        token,
        body: {
          courses: [{ courseId: pathCourseId, orderIndex: 0, required: true }],
        },
      });
      const published = await api<{ status: string }>('POST', `/learning-paths/${path.data.id}/publish`, {
        token,
      });
      record('Publish learning path from API', published.data?.status === 'PUBLISHED', published.err);

      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      if (aliceId) {
        const assignPath = await api<{ enrolledCount?: number; assignment?: { id: string } }>(
          'POST',
          `/learning-paths/${path.data.id}/assign`,
          {
            token,
            body: { targetType: 'USER', targetId: aliceId },
          },
        );
        record(
          'Assign learning path to user',
          assignPath.status === 201 && (assignPath.data?.enrolledCount ?? 0) >= 1,
          assignPath.err,
        );

        const pathAssignments = await api<unknown[]>('GET', `/learning-paths/${path.data.id}/assignments`, {
          token,
        });
        record(
          'List path assignments',
          Array.isArray(pathAssignments.data) && pathAssignments.data.length >= 1,
          pathAssignments.err,
        );

        const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
        const aliceToken = aliceLogin.data?.tokens?.accessToken;
        if (aliceToken) {
          const learnerProgress = await api<{
            pathEnrollment: { id: string } | null;
            courses: Array<{ state: string }>;
          }>('GET', `/learning-paths/${path.data.id}/learner-progress`, { token: aliceToken });
          record(
            'Path learner progress for enrolled user',
            !!learnerProgress.data?.pathEnrollment?.id &&
              Array.isArray(learnerProgress.data.courses) &&
              learnerProgress.data.courses.length >= 1 &&
              learnerProgress.data.courses[0]?.state !== 'LOCKED',
            learnerProgress.err,
          );
        }
      }

      await api('DELETE', `/courses/${pathCourseId}?force=true`, { token });
    }
    const draftList = await api<unknown[]>('GET', '/learning-paths?status=DRAFT', { token });
    record('Author sees draft paths', Array.isArray(draftList.data), draftList.err);
    await api('DELETE', `/learning-paths/${path.data.id}`, { token });
  }

  const employeeLogin = await login('alice@acme.com', 'Password123!', 'acme');
  const employeeToken = employeeLogin.data?.tokens?.accessToken;
  if (employeeToken) {
    const employeeDrafts = await api<unknown[]>('GET', '/learning-paths?status=DRAFT', {
      token: employeeToken,
    });
    record(
      'Employee cannot list draft paths',
      Array.isArray(employeeDrafts.data) && employeeDrafts.data.length === 0,
      `count ${employeeDrafts.data?.length ?? 'n/a'}`,
    );
  } else {
    record('Employee login', false, employeeLogin.err);
  }

  const completionCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Completion rules ${Date.now()}`, description: 'Completion test' },
  });
  record('Create course for completion rules', !!completionCourse.data?.id, completionCourse.err);
  const completionCourseId = completionCourse.data?.id;
  if (completionCourseId) {
    const reqLesson = await api<{ id: string }>('POST', `/courses/${completionCourseId}/lessons`, {
      token,
      body: { title: 'Required lesson', kind: 'READING', content: 'Required', required: true },
    });
    const optLesson = await api<{ id: string }>('POST', `/courses/${completionCourseId}/lessons`, {
      token,
      body: { title: 'Optional lesson', kind: 'READING', content: 'Optional', required: false },
    });
    await api('PATCH', `/courses/${completionCourseId}`, {
      token,
      body: { completionMode: 'REQUIRED_LESSONS' },
    });
    await api('POST', `/courses/${completionCourseId}/publish`, { token });

    const pctInvalid = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Pct invalid ${Date.now()}`, description: 'Validation' },
    });
    if (pctInvalid.data?.id) {
      await api('POST', `/courses/${pctInvalid.data.id}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'One' },
      });
      await api('PATCH', `/courses/${pctInvalid.data.id}`, {
        token,
        body: { completionMode: 'PERCENTAGE' },
      });
      const pctPublishBlocked = await api('POST', `/courses/${pctInvalid.data.id}/publish`, { token });
      record(
        'Publish rejects percentage mode without percent',
        pctPublishBlocked.code === 'VALIDATION_ERROR',
        pctPublishBlocked.err,
      );
      await api('DELETE', `/courses/${pctInvalid.data.id}?force=true`, { token });
    }

    const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
    const aliceToken = aliceLogin.data?.tokens?.accessToken;
    const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
      token,
    });
    const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
    if (aliceToken && reqLesson.data?.id && optLesson.data?.id && aliceId) {
      const completionEnroll = await api<{ id: string }>('POST', '/enrollments', {
        token,
        idempotencyKey: `completion-${completionCourseId}`,
        body: { userId: aliceId, courseId: completionCourseId },
      });
      const completionEnrollId = completionEnroll.data?.id;
      if (completionEnrollId) {
        const completeRequired = await api<{ enrollment?: { status: string; progressPercent?: number } }>(
          'POST',
          `/enrollments/${completionEnrollId}/progress/lessons/${reqLesson.data.id}/complete`,
          { token: aliceToken },
        );
        record(
          'Required-lessons mode completes after required only',
          completeRequired.data?.enrollment?.status === 'COMPLETED' &&
            (completeRequired.data?.enrollment?.progressPercent ?? 0) >= 100,
          `${completeRequired.data?.enrollment?.status ?? 'unknown'} ${completeRequired.data?.enrollment?.progressPercent ?? 0}%`,
        );
      }
    } else {
      record('Completion rules learner setup', false, 'Missing alice token or lessons');
    }

    if (aliceToken && aliceId) {
      const videoCourse = await api<{ id: string }>('POST', '/courses', {
        token,
        body: { title: `Video integrity ${Date.now()}`, description: 'Watch time required' },
      });
      if (videoCourse.data?.id) {
        const videoLesson = await api<{ id: string }>('POST', `/courses/${videoCourse.data.id}/lessons`, {
          token,
          body: {
            title: 'Watch me',
            kind: 'VIDEO',
            durationSeconds: 100,
            videoUrl: '/uploads/courses/demo/intro.mp4',
          },
        });
        await api('POST', `/courses/${videoCourse.data.id}/publish`, { token });
        const videoEnroll = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `video-integrity-${videoCourse.data.id}`,
          body: { userId: aliceId, courseId: videoCourse.data.id },
        });
        if (videoLesson.data?.id && videoEnroll.data?.id) {
          const coldComplete = await api(
            'POST',
            `/enrollments/${videoEnroll.data.id}/progress/lessons/${videoLesson.data.id}/complete`,
            { token: aliceToken },
          );
          record(
            'VIDEO complete without watch time is rejected',
            coldComplete.code === 'LESSON_COMPLETION_NOT_READY',
            coldComplete.err ?? `HTTP ${coldComplete.status}`,
          );
          await api('PUT', `/enrollments/${videoEnroll.data.id}/progress/lessons/${videoLesson.data.id}`, {
            token: aliceToken,
            body: { positionSeconds: 50 },
          });
          await api('PUT', `/enrollments/${videoEnroll.data.id}/progress/lessons/${videoLesson.data.id}`, {
            token: aliceToken,
            body: { positionSeconds: 90 },
          });
          const watchedComplete = await api(
            'POST',
            `/enrollments/${videoEnroll.data.id}/progress/lessons/${videoLesson.data.id}/complete`,
            { token: aliceToken },
          );
          record(
            'VIDEO complete after 90% watch time',
            watchedComplete.status === 200,
            watchedComplete.err,
          );
        }
        await api('DELETE', `/courses/${videoCourse.data.id}?force=true`, { token });
      }
    }

    const pctCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Percentage completion ${Date.now()}`, description: 'Pct test' },
    });
    if (pctCourse.data?.id && aliceToken && aliceId) {
      for (let i = 1; i <= 4; i += 1) {
        await api('POST', `/courses/${pctCourse.data.id}/lessons`, {
          token,
          body: { title: `Lesson ${i}`, kind: 'READING', content: `L${i}` },
        });
      }
      await api('PATCH', `/courses/${pctCourse.data.id}`, {
        token,
        body: { completionMode: 'PERCENTAGE', completionPercent: 50 },
      });
      await api('POST', `/courses/${pctCourse.data.id}/publish`, { token });
      const pctEnroll = await api<{ id: string }>('POST', '/enrollments', {
        token,
        idempotencyKey: `pct-${pctCourse.data.id}`,
        body: { userId: aliceId, courseId: pctCourse.data.id },
      });
      const pctCourseDetail = await api<{ lessons: Array<{ id: string }> }>(
        'GET',
        `/courses/${pctCourse.data.id}`,
        { token },
      );
      const pctLessons = pctCourseDetail.data?.lessons ?? [];
      if (pctEnroll.data?.id && pctLessons.length >= 2) {
        await api('POST', `/enrollments/${pctEnroll.data.id}/progress/lessons/${pctLessons[0]!.id}/complete`, {
          token: aliceToken,
        });
        const pctComplete = await api<{ enrollment?: { status: string; progressPercent?: number } }>(
          'POST',
          `/enrollments/${pctEnroll.data.id}/progress/lessons/${pctLessons[1]!.id}/complete`,
          { token: aliceToken },
        );
        record(
          'Percentage mode completes at configured threshold',
          pctComplete.data?.enrollment?.status === 'COMPLETED' &&
            (pctComplete.data?.enrollment?.progressPercent ?? 0) >= 100,
          `${pctComplete.data?.enrollment?.status ?? 'unknown'} ${pctComplete.data?.enrollment?.progressPercent ?? 0}%`,
        );
      }
      await api('DELETE', `/courses/${pctCourse.data.id}?force=true`, { token });
    }

    await api('DELETE', `/courses/${completionCourseId}?force=true`, { token });
  }

  const introUpload = await uploadIntroVideo(token, courseId);
  record(
    'Upload course intro video',
    !!introUpload.data?.videoUrl?.includes('-intro.mp4'),
    introUpload.err ?? introUpload.data?.videoUrl,
  );

  const dupSource = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Duplicate source ${Date.now()}`, description: 'Duplicate test' },
  });
  record('Create course for duplicate tests', !!dupSource.data?.id, dupSource.err);
  const dupSourceId = dupSource.data?.id;
  if (dupSourceId) {
    await api('POST', `/courses/${dupSourceId}/lessons`, {
      token,
      body: { title: 'Dup lesson', kind: 'READING', content: 'Copy me' },
    });
    await api('PATCH', `/courses/${dupSourceId}`, {
      token,
      body: { completionMode: 'REQUIRED_LESSONS', availableFrom: new Date().toISOString() },
    });
    await api('POST', `/courses/${dupSourceId}/publish`, { token });
    const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
      token,
    });
    const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
    if (aliceId) {
      const assigned = await api('POST', `/courses/${dupSourceId}/assign`, {
        token,
        body: { targetType: 'USER', targetId: aliceId },
        idempotencyKey: `dup-source-${dupSourceId}`,
      });
      record('Assign course before duplicate', assigned.status === 201, assigned.err);

      const dupWithout = await api<{ id: string; title: string; completionMode?: string }>(
        'POST',
        `/courses/${dupSourceId}/duplicate`,
        { token },
      );
      record('Duplicate course without assignments', !!dupWithout.data?.id, dupWithout.err);
      if (dupWithout.data?.id) {
        const withoutAssignments = await api<unknown[]>(
          'GET',
          `/courses/${dupWithout.data.id}/assignments`,
          { token },
        );
        record(
          'Duplicate excludes assignments by default',
          Array.isArray(withoutAssignments.data) && withoutAssignments.data.length === 0,
          `count ${withoutAssignments.data?.length ?? 'n/a'}`,
        );
        record(
          'Duplicate copies completion settings',
          dupWithout.data.completionMode === 'REQUIRED_LESSONS',
          dupWithout.data.completionMode,
        );
        await api('DELETE', `/courses/${dupWithout.data.id}?force=true`, { token });
      }

      const dupWith = await api<{ id: string }>(
        'POST',
        `/courses/${dupSourceId}/duplicate?includeAssignments=true`,
        { token },
      );
      record('Duplicate course with assignments', !!dupWith.data?.id, dupWith.err);
      if (dupWith.data?.id) {
        const withAssignments = await api<unknown[]>(
          'GET',
          `/courses/${dupWith.data.id}/assignments`,
          { token },
        );
        record(
          'Duplicate includes assignments when requested',
          Array.isArray(withAssignments.data) && withAssignments.data.length === 1,
          `count ${withAssignments.data?.length ?? 'n/a'}`,
        );
        await api('DELETE', `/courses/${dupWith.data.id}?force=true`, { token });
      }
    } else {
      record('Duplicate test user lookup', false, 'Missing alice user id');
    }
    await api('DELETE', `/courses/${dupSourceId}?force=true`, { token });
  }

  await api('DELETE', `/courses/${courseId}?force=true`, { token });

  const instructorLogin = await login('instructor@acme.com', 'Password123!', 'acme');
  const instructorToken = instructorLogin.data?.tokens?.accessToken;
  record('Instructor login', !!instructorToken, instructorLogin.err);

  const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
  const aliceToken = aliceLogin.data?.tokens?.accessToken;
  record('Employee login for RBAC', !!aliceToken, aliceLogin.err);

  if (aliceToken) {
    const blockedCreate = await api('POST', '/courses', {
      token: aliceToken,
      body: { title: 'Employee course', description: 'Should fail' },
    });
    record(
      'Employee blocked from creating courses',
      blockedCreate.code === 'RBAC_FORBIDDEN',
      blockedCreate.err,
    );
  }

  const adminCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `RBAC admin course ${Date.now()}`, description: 'Scope checks' },
  });
  record('Create admin-owned course for RBAC', !!adminCourse.data?.id, adminCourse.err);
  if (adminCourse.data?.id) {
    if (instructorToken) {
      const blockedPatch = await api('PATCH', `/courses/${adminCourse.data.id}`, {
        token: instructorToken,
        body: { title: 'Instructor takeover' },
      });
      record(
        'Instructor blocked from editing others courses',
        blockedPatch.code === 'RBAC_FORBIDDEN',
        blockedPatch.err,
      );
    }

    const rbacLesson = await api<{ id: string }>('POST', `/courses/${adminCourse.data.id}/lessons`, {
      token,
      body: { title: 'Asset lesson', kind: 'DOCUMENT', content: 'File lesson' },
    });
    if (rbacLesson.data?.id) {
      const assetUpload = await uploadLessonAsset(token, rbacLesson.data.id, 'document');
      const assetUrl = assetUpload.data?.lesson?.resourceUrl ?? assetUpload.data?.lesson?.videoUrl;
      record('Upload lesson document asset', !!assetUrl?.startsWith('/uploads/'), assetUpload.err ?? assetUrl);
    }

    const rbacAssessment = await api<{ id: string }>('POST', `/courses/${adminCourse.data.id}/assessments`, {
      token,
      body: {
        title: 'Final quiz',
        kind: 'FINAL',
        passingScore: 70,
        questions: [
          {
            prompt: 'Acknowledge completion criteria?',
            type: 'TRUE_FALSE',
            options: ['True', 'False'],
            correctOptionIndex: 0,
          },
        ],
      },
    });
    record('Create assessment for RBAC delete test', !!rbacAssessment.data?.id, rbacAssessment.err);
    if (rbacAssessment.data?.id && instructorToken) {
      const blockedDelete = await api('DELETE', `/assessments/${rbacAssessment.data.id}`, {
        token: instructorToken,
      });
      record(
        'Instructor blocked from deleting assessments',
        blockedDelete.code === 'RBAC_FORBIDDEN',
        blockedDelete.err,
      );
      await api('DELETE', `/assessments/${rbacAssessment.data.id}`, { token });
    }

    await api('DELETE', `/courses/${adminCourse.data.id}?force=true`, { token });
  }

  const e2eCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `E2E certificate ${Date.now()}`, description: 'Full completion flow' },
  });
  record('Create course for E2E certificate flow', !!e2eCourse.data?.id, e2eCourse.err);
  if (e2eCourse.data?.id && aliceToken) {
    const e2eLesson = await api<{ id: string }>('POST', `/courses/${e2eCourse.data.id}/lessons`, {
      token,
      body: { title: 'Single lesson', kind: 'READING', content: 'Complete me' },
    });
    await api('POST', `/courses/${e2eCourse.data.id}/publish`, { token });
    const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
      token,
    });
    const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
    if (e2eLesson.data?.id && aliceId) {
      const assigned = await api('POST', `/courses/${e2eCourse.data.id}/assign`, {
        token,
        body: { targetType: 'USER', targetId: aliceId },
        idempotencyKey: `e2e-assign-${e2eCourse.data.id}`,
      });
      record('Assign course in E2E flow', assigned.status === 201, assigned.err);

      const e2eEnroll = await api<{ id: string }>('POST', '/enrollments', {
        token,
        idempotencyKey: `e2e-enroll-${e2eCourse.data.id}`,
        body: { userId: aliceId, courseId: e2eCourse.data.id },
      });
      if (e2eEnroll.data?.id) {
        const complete = await api<{
          certificate?: { id: string };
          enrollment?: { status: string; progressPercent?: number };
        }>('POST', `/enrollments/${e2eEnroll.data.id}/progress/lessons/${e2eLesson.data.id}/complete`, {
          token: aliceToken,
        });
        record(
          'E2E course completion issues certificate',
          complete.data?.enrollment?.status === 'COMPLETED' &&
            (complete.data?.enrollment?.progressPercent ?? 0) >= 100 &&
            !!complete.data?.certificate?.id,
          `${complete.data?.enrollment?.status ?? 'unknown'} ${complete.data?.enrollment?.progressPercent ?? 0}% cert=${complete.data?.certificate?.id ? 'yes' : 'no'}`,
        );
      }
    }
    await api('DELETE', `/courses/${e2eCourse.data.id}?force=true`, { token });
  }

  const revisionCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Revision test ${Date.now()}`, description: 'Version one' },
  });
  record('Create course for revision history', !!revisionCourse.data?.id, revisionCourse.err);
  if (revisionCourse.data?.id) {
    await api('POST', `/courses/${revisionCourse.data.id}/lessons`, {
      token,
      body: { title: 'Lesson v1', kind: 'READING', content: 'First version' },
    });
    const publishV1 = await api<{ status: string }>('POST', `/courses/${revisionCourse.data.id}/publish`, {
      token,
    });
    record('Publish creates revision v1', publishV1.data?.status === 'PUBLISHED', publishV1.err);

    await api('PATCH', `/courses/${revisionCourse.data.id}`, {
      token,
      body: { title: 'Revision test updated', description: 'Version two' },
    });
    const publishV2 = await api('POST', `/courses/${revisionCourse.data.id}/publish`, { token });
    record('Republish creates revision v2', publishV2.status === 200, publishV2.err);

    const revisions = await api<Array<{ id: string; versionNumber: number; title: string }>>(
      'GET',
      `/courses/${revisionCourse.data.id}/revisions`,
      { token },
    );
    record(
      'List course revisions',
      Array.isArray(revisions.data) && revisions.data.length === 2,
      `count ${revisions.data?.length ?? 'n/a'}`,
    );

    const latestRevisionId = revisions.data?.find((row) => row.versionNumber === 2)?.id;
    if (latestRevisionId) {
      const revisionDetail = await api<{
        versionNumber: number;
        snapshot?: { course?: { title?: string; description?: string } };
      }>('GET', `/courses/${revisionCourse.data.id}/revisions/${latestRevisionId}`, { token });
      record(
        'Get revision snapshot',
        revisionDetail.data?.versionNumber === 2 &&
          revisionDetail.data?.snapshot?.course?.title === 'Revision test updated' &&
          revisionDetail.data?.snapshot?.course?.description === 'Version two',
        revisionDetail.err,
      );
    } else {
      record('Get revision snapshot', false, 'Missing revision id');
    }

    await api('DELETE', `/courses/${revisionCourse.data.id}?force=true`, { token });
  }

  const scormCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `SCORM test ${Date.now()}`, description: 'SCORM-only course' },
  });
  record('Create SCORM course shell', !!scormCourse.data?.id, scormCourse.err);
  const scormCourseId = scormCourse.data?.id;
  if (scormCourseId) {
    const uploaded = await uploadScorm(token, scormCourseId);
    record('Upload SCORM package', !!uploaded.data?.launchUrl, uploaded.err);

    const published = await api<{ status: string }>('POST', `/courses/${scormCourseId}/publish`, { token });
    record('Publish SCORM-only course', published.data?.status === 'PUBLISHED', published.err);

    const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
    const aliceToken = aliceLogin.data?.tokens?.accessToken;
    if (aliceToken) {
      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      const enrollRes = await api<{ id: string }>('POST', '/enrollments', {
        token,
        idempotencyKey: `scorm-test-${scormCourseId}`,
        body: { userId: aliceId, courseId: scormCourseId },
      });
      const enrollmentId = enrollRes.data?.id;
      record('Enroll learner in SCORM course', !!enrollmentId, enrollRes.err);

      if (enrollmentId) {
        const launch = await api<{ playerUrl: string }>('GET', `/learn/scorm/${enrollmentId}/launch`, {
          token: aliceToken,
        });
        record('SCORM launch metadata', !!launch.data?.playerUrl, launch.err);

        const contentRes = await fetch(
          `${API}/learn/scorm/${enrollmentId}/content/index.html`,
          { headers: { Authorization: `Bearer ${aliceToken}` } },
        );
        record('SCORM content file', contentRes.status === 200, `HTTP ${contentRes.status}`);

        const commit = await api('POST', `/learn/scorm/${enrollmentId}/commit`, {
          token: aliceToken,
          body: {
            values: {
              'cmi.core.lesson_status': 'completed',
              'cmi.core.lesson_location': '',
              'cmi.suspend_data': '',
              'cmi.core.session_time': '0000:02:00',
              'cmi.core.score.raw': '100',
            },
          },
        });
        record('SCORM CMI commit', commit.status === 200, commit.err);

        const detail = await api<{ status: string; progressPercent?: number }>(
          'GET',
          `/enrollments/${enrollmentId}`,
          { token: aliceToken },
        );
        record(
          'SCORM completion updates enrollment',
          detail.data?.status === 'COMPLETED' && (detail.data?.progressPercent ?? 0) >= 100,
          `${detail.data?.status ?? 'unknown'} ${detail.data?.progressPercent ?? 0}%`,
        );
      }
    }

    await api('DELETE', `/courses/${scormCourseId}?force=true`, { token });
  }

  // Announcements, forums, ILT/VILT sessions
  const annTitle = `Integration announcement ${Date.now()}`;
  const announcement = await api<{ id: string }>('POST', '/announcements', {
    token,
    body: {
      title: annTitle,
      body: 'Scheduled maintenance this weekend.',
      publishedAt: new Date().toISOString(),
    },
  });
  record('Create published org announcement', !!announcement.data?.id, announcement.err);

  const aliceFeaturesLogin = await login('alice@acme.com', 'Password123!', 'acme');
  const aliceFeaturesToken = aliceFeaturesLogin.data?.tokens?.accessToken;
  if (aliceFeaturesToken && announcement.data?.id) {
    const activeAnnouncements = await api<Array<{ id: string; title: string }>>(
      'GET',
      '/announcements/active',
      { token: aliceFeaturesToken },
    );
    record(
      'Learner sees active announcement',
      activeAnnouncements.data?.some((row) => row.id === announcement.data!.id) ?? false,
      activeAnnouncements.err,
    );

    const annNotifications = await api<{ items: Array<{ kind: string; title: string }> }>(
      'GET',
      '/notifications?pageSize=50',
      { token: aliceFeaturesToken },
    );
    record(
      'Publish announcement creates notification',
      annNotifications.data?.items?.some((row) => row.kind === 'ANNOUNCEMENT') ?? false,
      annNotifications.err,
    );
  } else {
    record('Learner announcement checks', false, 'Missing alice token or announcement id');
  }

  if (aliceFeaturesToken) {
    const orgThread = await api<{ id: string }>('POST', '/forums/threads', {
      token: aliceFeaturesToken,
      body: { title: `Org thread ${Date.now()}`, body: 'Hello everyone' },
    });
    record('Create org forum thread', !!orgThread.data?.id, orgThread.err);

    const orgThreadList = await api<{ items: Array<{ id: string }> }>(
      'GET',
      '/forums/threads?pageSize=20',
      { token: aliceFeaturesToken },
    );
    record(
      'List org forum threads',
      orgThreadList.data?.items?.some((row) => row.id === orgThread.data?.id) ?? false,
      orgThreadList.err,
    );
  }

  const forumCourse = await api<{ id: string }>('POST', '/courses', {
    token,
    body: { title: `Forum ILT test ${Date.now()}`, description: 'Forums and sessions' },
  });
  record('Create forum/ILT test course', !!forumCourse.data?.id, forumCourse.err);
  const forumCourseId = forumCourse.data?.id;

  if (forumCourseId) {
    const iltLessonRes = await api<{ id: string }>('POST', `/courses/${forumCourseId}/lessons`, {
      token,
      body: { title: 'Workshop', kind: 'ILT', content: 'Attend live', required: true },
    });
    record('Create ILT lesson', !!iltLessonRes.data?.id, iltLessonRes.err);

    const publishedForumCourse = await api<{ status: string }>('POST', `/courses/${forumCourseId}/publish`, {
      token,
    });
    record('Publish forum/ILT course', publishedForumCourse.data?.status === 'PUBLISHED', publishedForumCourse.err);

    const usersForForum = await api<{ items: Array<{ id: string; email: string }> }>(
      'GET',
      '/users?pageSize=20',
      { token },
    );
    const aliceForumId = usersForForum.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
    const bobForumId = usersForForum.data?.items.find((u) => u.email === 'bob@acme.com')?.id;

    if (aliceForumId) {
      await api('POST', '/enrollments', {
        token,
        idempotencyKey: `forum-ilt-${forumCourseId}-alice`,
        body: { userId: aliceForumId, courseId: forumCourseId },
      });
    }

    const bobLogin = await login('bob@acme.com', 'Password123!', 'acme');
    const bobToken = bobLogin.data?.tokens?.accessToken;

    if (aliceFeaturesToken && forumCourseId) {
      const courseThread = await api<{ id: string }>(
        'POST',
        `/courses/${forumCourseId}/forum/threads`,
        {
          token: aliceFeaturesToken,
          body: { title: 'Course discussion', body: 'Week 1 thoughts' },
        },
      );
      record('Enrolled learner creates course forum thread', !!courseThread.data?.id, courseThread.err);

      if (bobToken) {
        const bobBlocked = await api(
          'POST',
          `/courses/${forumCourseId}/forum/threads`,
          {
            token: bobToken,
            body: { title: 'Should fail', body: 'Not enrolled' },
          },
        );
        record(
          'Non-enrolled user blocked from course forum',
          bobBlocked.status === 403 || bobBlocked.code === 'RBAC_FORBIDDEN',
          bobBlocked.err,
        );
      }
    }

    if (iltLessonRes.data?.id && aliceForumId && aliceFeaturesToken) {
      const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 3600000).toISOString();
      const session = await api<{ id: string; lessonId: string }>(
        'POST',
        `/courses/${forumCourseId}/sessions`,
        {
          token,
          body: {
            lessonId: iltLessonRes.data.id,
            title: 'Cohort session',
            deliveryMode: 'ILT',
            startsAt,
            endsAt,
            location: 'Room 101',
            capacity: 10,
          },
        },
      );
      record('Create ILT session', !!session.data?.id, session.err);

      if (session.data?.id) {
        const register = await api<{ userId: string; status: string }>(
          'POST',
          `/courses/${forumCourseId}/sessions/${session.data.id}/register`,
          { token: aliceFeaturesToken },
        );
        record('Learner registers for session', register.data?.status === 'REGISTERED', register.err);

        const attendance = await api(
          'POST',
          `/courses/${forumCourseId}/sessions/${session.data.id}/attendance`,
          {
            token,
            body: { userIds: [aliceForumId], status: 'ATTENDED' },
          },
        );
        record('Mark session attendance', attendance.status === 200, attendance.err);

        const enrollments = await api<{ items: Array<{ userId: string; progressPercent?: number }> }>(
          'GET',
          `/enrollments?courseId=${forumCourseId}&userId=${aliceForumId}&pageSize=1`,
          { token: aliceFeaturesToken },
        );
        const aliceEnrollment = enrollments.data?.items?.[0];
        record(
          'Attendance marks ILT lesson complete',
          (aliceEnrollment?.progressPercent ?? 0) >= 100,
          `${aliceEnrollment?.progressPercent ?? 0}%`,
        );
      }
    }

    await api('DELETE', `/courses/${forumCourseId}?force=true`, { token });
    if (announcement.data?.id) {
      await api('DELETE', `/announcements/${announcement.data.id}`, { token });
    }
  }

  if (aliceToken) {
    const integrityCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Assessment integrity ${Date.now()}`, description: 'Phase 1' },
    });
    record('Create course for assessment integrity', !!integrityCourse.data?.id, integrityCourse.err);

    if (integrityCourse.data?.id) {
      const integrityLesson = await api<{ id: string }>('POST', `/courses/${integrityCourse.data.id}/lessons`, {
        token,
        body: { title: 'Required lesson', kind: 'READING', content: 'Finish me' },
      });
      const integrityAssessment = await api<{
        id: string;
        questions?: Array<{ correctOptionId?: string }>;
      }>('POST', `/courses/${integrityCourse.data.id}/assessments`, {
        token,
        body: {
          title: 'Integrity final',
          kind: 'FINAL',
          passingScore: 70,
          questions: [
            {
              prompt: 'Pick A',
              type: 'MCQ',
              options: ['A', 'B'],
              correctOptionIndex: 0,
            },
          ],
        },
      });
      await api('POST', `/courses/${integrityCourse.data.id}/publish`, { token });

      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      if (integrityAssessment.data?.id && integrityLesson.data?.id && aliceId) {
        await api('POST', `/courses/${integrityCourse.data.id}/assign`, {
          token,
          body: { targetType: 'USER', targetId: aliceId },
          idempotencyKey: `integrity-assign-${integrityCourse.data.id}`,
        });
        const integrityEnroll = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `integrity-enroll-${integrityCourse.data.id}`,
          body: { userId: aliceId, courseId: integrityCourse.data.id },
        });

        const learnerGetBeforeStart = await api<{
          questions?: Array<{ correctOptionId?: string; prompt?: string }>;
        }>('GET', `/assessments/${integrityAssessment.data.id}`, { token: aliceToken });
        record(
          'Learner GET hides questions before start',
          Array.isArray(learnerGetBeforeStart.data?.questions) &&
            learnerGetBeforeStart.data!.questions!.length === 0,
          `questions=${learnerGetBeforeStart.data?.questions?.length ?? 'n/a'}`,
        );

        const authorGet = await api<{
          questions?: Array<{ correctOptionId?: string }>;
        }>('GET', `/assessments/${integrityAssessment.data.id}`, { token });
        record(
          'Author GET includes answer keys',
          !!authorGet.data?.questions?.[0]?.correctOptionId,
          authorGet.err,
        );

        const aliceBanks = await api('GET', '/question-banks', { token: aliceToken });
        record(
          'Learner blocked from listing question banks',
          aliceBanks.code === 'RBAC_FORBIDDEN' || aliceBanks.status === 403,
          aliceBanks.err,
        );

        if (integrityEnroll.data?.id) {
          const blockedStart = await api('POST', `/assessments/${integrityAssessment.data.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: integrityEnroll.data.id },
          });
          record(
            'FINAL start blocked before lessons complete',
            blockedStart.code === 'ENROLLMENT_NOT_READY',
            blockedStart.err,
          );

          await api(
            'POST',
            `/enrollments/${integrityEnroll.data.id}/progress/lessons/${integrityLesson.data.id}/complete`,
            { token: aliceToken },
          );

          const blockedSubmit = await api('POST', `/assessments/${integrityAssessment.data.id}/submit`, {
            token: aliceToken,
            body: {
              enrollmentId: integrityEnroll.data.id,
              answers: [],
            },
          });
          record(
            'Submit blocked without start',
            blockedSubmit.code === 'VALIDATION_ERROR',
            blockedSubmit.err,
          );

          const started = await api<{
            attempt: { id: string };
            questions?: Array<{ correctOptionId?: string; prompt?: string }>;
          }>('POST', `/assessments/${integrityAssessment.data.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: integrityEnroll.data.id },
          });
          record(
            'FINAL start succeeds after lessons complete',
            !!started.data?.attempt?.id && (started.data?.questions?.length ?? 0) > 0,
            started.err,
          );
          record(
            'Started attempt hides answer keys',
            !started.data?.questions?.some((q) => q.correctOptionId),
            started.err,
          );

          if (started.data?.attempt?.id && started.data.questions?.[0]?.id) {
            const q = started.data.questions[0];
            const optionId =
              q.type === 'MCQ' || q.type === 'TRUE_FALSE'
                ? q.options?.[0]?.id
                : undefined;
            const submitted = await api<{ attempt: { score: number | null; passed: boolean } }>(
              'POST',
              `/assessments/${integrityAssessment.data.id}/submit`,
              {
                token: aliceToken,
                body: {
                  enrollmentId: integrityEnroll.data.id,
                  attemptId: started.data.attempt.id,
                  answers: optionId ? [{ questionId: q.id, optionId }] : [],
                },
              },
            );
            record(
              'Submit after start grades attempt',
              submitted.data?.attempt?.score != null,
              submitted.err,
            );

            const learnerGetAfterSubmit = await api<{
              questions?: Array<{ correctOptionId?: string }>;
            }>('GET', `/assessments/${integrityAssessment.data.id}`, { token: aliceToken });
            record(
              'Learner GET hides questions after submit (no active attempt)',
              Array.isArray(learnerGetAfterSubmit.data?.questions) &&
                learnerGetAfterSubmit.data!.questions!.length === 0 &&
                !learnerGetAfterSubmit.data?.questions?.some((q) => q.correctOptionId),
              `questions=${learnerGetAfterSubmit.data?.questions?.length ?? 'n/a'}`,
            );

            const reviewHidden = await api<{
              showAnswers: boolean;
              items: Array<{ correctOptionId?: string; correct: boolean | null }>;
            }>('GET', `/assessments/${integrityAssessment.data.id}/attempts/${started.data.attempt.id}/review`, {
              token: aliceToken,
            });
            record(
              'Review available after submit',
              reviewHidden.status === 200 && reviewHidden.data?.items?.length === 1,
              reviewHidden.err,
            );
            record(
              'Review hides answer keys by default',
              reviewHidden.data?.showAnswers === false &&
                !reviewHidden.data?.items?.some((i) => i.correctOptionId),
              reviewHidden.err,
            );

            const openReview = await api('GET', `/assessments/${integrityAssessment.data.id}/attempts/${started.data.attempt.id}/review`, {
              token: aliceToken,
            });
            // Start a fresh attempt to test blocked review on open attempt
            const secondStart = await api<{ attempt: { id: string }; questions: Array<{ id: string; options?: Array<{ id: string }> }> }>(
              'POST',
              `/assessments/${integrityAssessment.data.id}/start`,
              { token: aliceToken, body: { enrollmentId: integrityEnroll.data.id } },
            );
            if (secondStart.data?.attempt?.id) {
              const blockedReview = await api(
                'GET',
                `/assessments/${integrityAssessment.data.id}/attempts/${secondStart.data.attempt.id}/review`,
                { token: aliceToken },
              );
              record(
                'Review blocked for open attempt',
                blockedReview.code === 'VALIDATION_ERROR',
                blockedReview.err,
              );
            } else {
              record('Review blocked for open attempt', false, secondStart.err);
            }

            await api('PATCH', '/organizations/current', {
              token,
              body: {
                settings: { showAnswersAfterAttempt: true },
              },
            });
            const reviewShown = await api<{
              showAnswers: boolean;
              items: Array<{ correctOptionId?: string }>;
            }>('GET', `/assessments/${integrityAssessment.data.id}/attempts/${started.data.attempt.id}/review`, {
              token: aliceToken,
            });
            record(
              'Review shows answer keys when org setting enabled',
              reviewShown.data?.showAnswers === true &&
                !!reviewShown.data?.items?.[0]?.correctOptionId,
              reviewShown.err,
            );
            await api('PATCH', '/organizations/current', {
              token,
              body: {
                settings: { showAnswersAfterAttempt: false },
              },
            });
            void openReview;
          }
        }
      }

      await api('DELETE', `/courses/${integrityCourse.data.id}?force=true`, { token });
    }

    const phase4Course = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Assessment phase4 ${Date.now()}`, description: 'Question types' },
    });
    record('Create course for assessment phase 4', !!phase4Course.data?.id, phase4Course.err);

    if (phase4Course.data?.id) {
      const phase4Lesson = await api<{ id: string }>('POST', `/courses/${phase4Course.data.id}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'Read' },
      });
      const phase4Assessment = await api<{ id: string }>('POST', `/courses/${phase4Course.data.id}/assessments`, {
        token,
        body: {
          title: 'Phase 4 types',
          kind: 'FINAL',
          passingScore: 50,
          questions: [
            {
              prompt: 'Capital of France',
              type: 'FILL_BLANK',
              points: 2,
              blanks: [{ acceptableAnswers: ['Paris', 'paris'] }],
            },
            {
              prompt: 'Match sounds',
              type: 'MATCHING',
              points: 1,
              pairs: [
                { left: 'Cat', right: 'Meow' },
                { left: 'Dog', right: 'Woof' },
              ],
            },
          ],
        },
      });
      await api('POST', `/courses/${phase4Course.data.id}/publish`, { token });

      const usersP4 = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceP4Id = usersP4.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      if (phase4Assessment.data?.id && phase4Lesson.data?.id && aliceP4Id && aliceToken) {
        const p4Enroll = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `phase4-enroll-${phase4Course.data.id}`,
          body: { userId: aliceP4Id, courseId: phase4Course.data.id },
        });
        if (p4Enroll.data?.id) {
          await api(
            'POST',
            `/enrollments/${p4Enroll.data.id}/progress/lessons/${phase4Lesson.data.id}/complete`,
            { token: aliceToken },
          );
          const p4Start = await api<{
            attempt: { id: string };
            questions: Array<{ id: string; type: string; metadata?: Record<string, unknown> }>;
          }>('POST', `/assessments/${phase4Assessment.data.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: p4Enroll.data.id },
          });
          if (p4Start.data?.questions?.length === 2) {
            const fillQ = p4Start.data.questions.find((q) => q.type === 'FILL_BLANK');
            const matchQ = p4Start.data.questions.find((q) => q.type === 'MATCHING');
            const blankId = Array.isArray(fillQ?.metadata?.blanks)
              ? (fillQ!.metadata!.blanks as Array<{ id: string }>)[0]?.id
              : undefined;
            const leftItemsFull = Array.isArray(matchQ?.metadata?.leftItems)
              ? (matchQ!.metadata!.leftItems as Array<{ id: string; text: string }>)
              : [];
            const rightItems = Array.isArray(matchQ?.metadata?.rightItems)
              ? (matchQ!.metadata!.rightItems as Array<{ id: string; text: string }>)
              : [];
            const p4Submit = await api<{ attempt: { score: number | null; passed: boolean } }>(
              'POST',
              `/assessments/${phase4Assessment.data.id}/submit`,
              {
                token: aliceToken,
                body: {
                  enrollmentId: p4Enroll.data.id,
                  attemptId: p4Start.data.attempt.id,
                  answers: [
                    blankId && fillQ
                      ? { questionId: fillQ.id, blanks: [{ blankId, text: 'Paris' }] }
                      : { questionId: fillQ!.id, blanks: [] },
                    matchQ
                      ? {
                          questionId: matchQ.id,
                          matches: leftItemsFull.map((left) => {
                            const right = rightItems.find((r) =>
                              (left.text === 'Cat' && r.text === 'Meow') ||
                              (left.text === 'Dog' && r.text === 'Woof'),
                            );
                            return { leftId: left.id, rightId: right?.id ?? '' };
                          }),
                        }
                      : { questionId: matchQ!.id, matches: [] },
                  ],
                },
              },
            );
            record(
              'Fill-blank and matching auto-grade with weighted score',
              p4Submit.data?.attempt?.score === 100 && p4Submit.data?.attempt?.passed === true,
              `${p4Submit.data?.attempt?.score ?? 'n/a'}%`,
            );
          } else {
            record('Fill-blank and matching auto-grade with weighted score', false, p4Start.err);
          }

          const bank = await api<{ id: string }>('POST', '/question-banks', {
            token,
            body: { name: `Phase4 bank ${Date.now()}`, description: 'Tagged draw' },
          });
          if (bank.data?.id) {
            await api('POST', `/question-banks/${bank.data.id}/questions`, {
              token,
              body: {
                question: 'Tagged MCQ',
                type: 'MCQ',
                options: ['A', 'B'],
                correctOptionIndex: 0,
                tags: ['safety'],
              },
            });
            await api('POST', `/question-banks/${bank.data.id}/questions`, {
              token,
              body: {
                question: 'Untagged MCQ',
                type: 'MCQ',
                options: ['A', 'B'],
                correctOptionIndex: 0,
                tags: ['other'],
              },
            });
            const bankAssessment = await api<{ id: string }>('POST', `/courses/${phase4Course.data.id}/assessments`, {
              token,
              body: {
                title: 'Tagged bank draw',
                kind: 'PRE',
                bankId: bank.data.id,
                drawCount: 1,
                drawTags: ['safety'],
              },
            });
            record('Create tagged bank assessment', !!bankAssessment.data?.id, bankAssessment.err);

            const blockedDelete = await api('DELETE', `/question-banks/${bank.data.id}`, { token });
            record(
              'Bank delete blocked when referenced',
              blockedDelete.code === 'VALIDATION_ERROR',
              blockedDelete.err,
            );

            const patchQuestion = await api('GET', `/question-banks/${bank.data.id}`, { token });
            const bankQId = (
              patchQuestion.data as { questions?: Array<{ id: string }> } | null
            )?.questions?.[0]?.id;
            if (bankQId) {
              const updatedQ = await api('PATCH', `/question-banks/${bank.data.id}/questions/${bankQId}`, {
                token,
                body: { question: 'Updated tagged MCQ', points: 3 },
              });
              record('Patch bank question', updatedQ.status === 200, updatedQ.err);
            } else {
              record('Patch bank question', false, 'Missing bank question');
            }
          } else {
            record('Create tagged bank assessment', false, bank.err);
            record('Bank delete blocked when referenced', false, 'Bank create failed');
            record('Patch bank question', false, 'Bank create failed');
          }
        }
      }

      await api('DELETE', `/courses/${phase4Course.data.id}?force=true`, { token });
    }
  }

  if (aliceToken && instructorToken) {
    const lifecycleCourse = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Assessment lifecycle ${Date.now()}`, description: 'Phase 2' },
    });
    record('Create course for assessment lifecycle', !!lifecycleCourse.data?.id, lifecycleCourse.err);

    if (lifecycleCourse.data?.id) {
      await api('POST', `/courses/${lifecycleCourse.data.id}/lessons`, {
        token,
        body: { title: 'Lesson', kind: 'READING', content: 'Done' },
      });
      const timedAssessment = await api<{ id: string }>('POST', `/courses/${lifecycleCourse.data.id}/assessments`, {
        token,
        body: {
          title: 'Timed PRE',
          kind: 'PRE',
          passingScore: 70,
          timeLimitSeconds: 2,
          maxAttempts: 5,
          questions: [
            {
              prompt: 'Quick check?',
              type: 'TRUE_FALSE',
              options: ['True', 'False'],
              correctOptionIndex: 0,
            },
          ],
        },
      });
      const shortAssessment = await api<{ id: string }>('POST', `/courses/${lifecycleCourse.data.id}/assessments`, {
        token,
        body: {
          title: 'Short answer FINAL',
          kind: 'FINAL',
          passingScore: 70,
          maxAttempts: 3,
          questions: [{ prompt: 'Explain safety.', type: 'SHORT_ANSWER' }],
        },
      });
      await api('POST', `/courses/${lifecycleCourse.data.id}/publish`, { token });

      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;
      if (timedAssessment.data?.id && shortAssessment.data?.id && aliceId) {
        await api('POST', `/courses/${lifecycleCourse.data.id}/assign`, {
          token,
          body: { targetType: 'USER', targetId: aliceId },
          idempotencyKey: `lifecycle-assign-${lifecycleCourse.data.id}`,
        });
        const lifecycleEnroll = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `lifecycle-enroll-${lifecycleCourse.data.id}`,
          body: { userId: aliceId, courseId: lifecycleCourse.data.id },
        });

        if (lifecycleEnroll.data?.id) {
          const lessonList = await api<Array<{ id: string }>>(
            'GET',
            `/courses/${lifecycleCourse.data.id}/lessons`,
            { token },
          );
          const lessonId = lessonList.data?.[0]?.id;
          if (lessonId) {
            await api(
              'POST',
              `/enrollments/${lifecycleEnroll.data.id}/progress/lessons/${lessonId}/complete`,
              { token: aliceToken },
            );
          }

          const timedStart = await api<{ attempt: { id: string } }>(
            'POST',
            `/assessments/${timedAssessment.data.id}/start`,
            { token: aliceToken, body: { enrollmentId: lifecycleEnroll.data.id } },
          );
          if (timedStart.data?.attempt?.id) {
            await new Promise((r) => setTimeout(r, 2200));
            const expired = await api('POST', `/assessments/${timedAssessment.data.id}/expire`, {
              token: aliceToken,
              body: { enrollmentId: lifecycleEnroll.data.id },
            });
            record('Expire timed attempt after deadline', expired.status === 200, expired.err);

            const afterExpireGet = await api<{ activeAttempt?: { id: string } }>(
              'GET',
              `/assessments/${timedAssessment.data.id}`,
              { token: aliceToken },
            );
            record(
              'No active attempt after expire',
              !afterExpireGet.data?.activeAttempt,
              afterExpireGet.err,
            );

            const restart = await api('POST', `/assessments/${timedAssessment.data.id}/start`, {
              token: aliceToken,
              body: { enrollmentId: lifecycleEnroll.data.id },
            });
            record('Start new attempt after expire', restart.status === 200, restart.err);
          } else {
            record('Expire timed attempt after deadline', false, timedStart.err);
            record('No active attempt after expire', false, 'Timed start failed');
            record('Start new attempt after expire', false, 'Timed start failed');
          }

          const shortStart = await api<{ attempt: { id: string }; questions: Array<{ id: string }> }>(
            'POST',
            `/assessments/${shortAssessment.data.id}/start`,
            { token: aliceToken, body: { enrollmentId: lifecycleEnroll.data.id } },
          );
          if (shortStart.data?.attempt?.id && shortStart.data.questions?.[0]?.id) {
            const qid = shortStart.data.questions[0].id;
            const pending = await api('POST', `/assessments/${shortAssessment.data.id}/submit`, {
              token: aliceToken,
              body: {
                enrollmentId: lifecycleEnroll.data.id,
                attemptId: shortStart.data.attempt.id,
                answers: [{ questionId: qid, text: 'Safety first.' }],
              },
            });
            record('Short answer submits as pending review', pending.status === 200, pending.err);

            const resubmit = await api('POST', `/assessments/${shortAssessment.data.id}/submit`, {
              token: aliceToken,
              body: {
                enrollmentId: lifecycleEnroll.data.id,
                attemptId: shortStart.data.attempt.id,
                answers: [{ questionId: qid, text: 'Changed answer.' }],
              },
            });
            record(
              'Pending attempt cannot be resubmitted',
              resubmit.code === 'VALIDATION_ERROR',
              resubmit.err,
            );

            const pendingList = await api<Array<{ id: string }>>('GET', '/assessments/pending-review', {
              token,
            });
            const attemptId = shortStart.data.attempt.id;
            const blockedGrade = await api('PATCH', `/assessments/attempts/${attemptId}/grade`, {
              token: instructorToken,
              body: { score: 80, passed: true },
            });
            record(
              'Instructor blocked from grading others course attempts',
              blockedGrade.code === 'RBAC_FORBIDDEN',
              blockedGrade.err,
            );
            record(
              'Admin sees pending review attempt',
              Array.isArray(pendingList.data) && pendingList.data.some((a) => a.id === attemptId),
              pendingList.err,
            );

            const gradeRes = await api('PATCH', `/assessments/attempts/${attemptId}/grade`, {
              token,
              body: { score: 85, passed: true, instructorFeedback: 'Good explanation.' },
            });
            record('Admin grades pending review attempt', gradeRes.status === 200, gradeRes.err);

            const afterGrade = await api<Array<{ id: string }>>('GET', '/assessments/pending-review', {
              token,
            });
            record(
              'Graded attempt removed from pending queue',
              Array.isArray(afterGrade.data) && !afterGrade.data.some((a) => a.id === attemptId),
              afterGrade.err,
            );
          } else {
            record('Short answer submits as pending review', false, shortStart.err);
            record('Pending attempt cannot be resubmitted', false, 'Short start failed');
            record('Instructor blocked from grading others course attempts', false, 'Short start failed');
            record('Admin sees pending review attempt', false, 'Short start failed');
            record('Admin grades pending review attempt', false, 'Short start failed');
            record('Graded attempt removed from pending queue', false, 'Short start failed');
          }
        }
      }

      await api('DELETE', `/courses/${lifecycleCourse.data.id}?force=true`, { token });
    }
  }

  if (token) {
    const aliceLogin = await login('alice@acme.com', 'Password123!', 'acme');
    const aliceToken = aliceLogin.data?.tokens?.accessToken;
    const phase5Course = await api<{ id: string }>('POST', '/courses', {
      token,
      body: { title: `Phase 5 kinds ${Date.now()}`, description: 'Assessment kinds expansion' },
    });
    record('Create course for Phase 5', !!phase5Course.data?.id, phase5Course.err);

    if (phase5Course.data?.id && aliceToken) {
      const quizLesson = await api<{ id: string }>('POST', `/courses/${phase5Course.data.id}/lessons`, {
        token,
        body: { title: 'Module quiz lesson', kind: 'QUIZ', content: 'Quiz content' },
      });
      const readingLesson = await api<{ id: string }>('POST', `/courses/${phase5Course.data.id}/lessons`, {
        token,
        body: { title: 'Reading lesson', kind: 'READING', content: 'Read this' },
      });

      const preAssessment = await api<{ id: string }>('POST', `/courses/${phase5Course.data.id}/assessments`, {
        token,
        body: {
          title: 'Required PRE',
          kind: 'PRE',
          passingScore: 70,
          questions: [
            {
              prompt: 'Ready?',
              type: 'TRUE_FALSE',
              options: ['True', 'False'],
              correctOptionIndex: 0,
            },
          ],
        },
      });

      const survey = await api<{ id: string; anonymous: boolean }>(
        'POST',
        `/courses/${phase5Course.data.id}/assessments`,
        {
          token,
          body: {
            title: 'Course feedback',
            kind: 'SURVEY',
            anonymous: true,
            questions: [
              {
                prompt: 'How was the course?',
                type: 'MCQ',
                options: ['Great', 'Okay', 'Poor'],
                correctOptionIndex: 0,
              },
            ],
          },
        },
      );

      const moduleQuiz =
        quizLesson.data?.id &&
        (await api<{ id: string; lessonId: string }>('POST', `/courses/${phase5Course.data.id}/assessments`, {
          token,
          body: {
            title: 'Lesson check',
            kind: 'MODULE_QUIZ',
            lessonId: quizLesson.data.id,
            passingScore: 70,
            questions: [
              {
                prompt: '2 + 2 = 4?',
                type: 'TRUE_FALSE',
                options: ['True', 'False'],
                correctOptionIndex: 0,
              },
            ],
          },
        }));

      const duplicateModuleQuiz =
        quizLesson.data?.id &&
        (await api('POST', `/courses/${phase5Course.data.id}/assessments`, {
          token,
          body: {
            title: 'Duplicate lesson quiz',
            kind: 'MODULE_QUIZ',
            lessonId: quizLesson.data.id,
            passingScore: 70,
            questions: [
              {
                prompt: 'Duplicate?',
                type: 'TRUE_FALSE',
                options: ['True', 'False'],
                correctOptionIndex: 0,
              },
            ],
          },
        }));

      await api('PATCH', `/courses/${phase5Course.data.id}`, {
        token,
        body: { requirePreAssessment: true },
      });
      await api('POST', `/courses/${phase5Course.data.id}/publish`, { token });

      const users = await api<{ items: Array<{ id: string; email: string }> }>('GET', '/users?pageSize=20', {
        token,
      });
      const aliceId = users.data?.items.find((u) => u.email === 'alice@acme.com')?.id;

      if (
        preAssessment.data?.id &&
        survey.data?.id &&
        moduleQuiz &&
        moduleQuiz.data?.id &&
        readingLesson.data?.id &&
        aliceId
      ) {
        await api('POST', `/courses/${phase5Course.data.id}/assign`, {
          token,
          body: { targetType: 'USER', targetId: aliceId },
          idempotencyKey: `phase5-assign-${phase5Course.data.id}`,
        });
        const enroll = await api<{ id: string }>('POST', '/enrollments', {
          token,
          idempotencyKey: `phase5-enroll-${phase5Course.data.id}`,
          body: { userId: aliceId, courseId: phase5Course.data.id },
        });

        if (enroll.data?.id) {
          const blockedProgress = await api(
            'PUT',
            `/enrollments/${enroll.data.id}/progress/lessons/${readingLesson.data.id}`,
            {
              token: aliceToken,
              body: { completed: true },
            },
          );
          record(
            'PRE gate blocks lesson progress',
            blockedProgress.code === 'PRE_ASSESSMENT_REQUIRED',
            blockedProgress.err,
          );

          const preStart = await api<{
            attempt: { id: string };
            questions: Array<{ id: string; options: Array<{ id: string }> }>;
          }>('POST', `/assessments/${preAssessment.data.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: enroll.data.id },
          });
          const preQ = preStart.data?.questions?.[0];
          const preTrueOption = preQ?.options.find((opt) => opt.text === 'True') ?? preQ?.options[0];
          const preSubmit =
            preStart.data?.attempt?.id &&
            preQ &&
            preTrueOption &&
            (await api<{ attempt: { passed: boolean } }>(
              'POST',
              `/assessments/${preAssessment.data.id}/submit`,
              {
                token: aliceToken,
                body: {
                  enrollmentId: enroll.data.id,
                  attemptId: preStart.data.attempt.id,
                  answers: [{ questionId: preQ.id, optionId: preTrueOption.id }],
                },
              },
            ));
          record('PRE assessment can be passed', preSubmit?.data?.attempt.passed === true, preSubmit?.err);

          const allowedProgress = await api(
            'PUT',
            `/enrollments/${enroll.data.id}/progress/lessons/${readingLesson.data.id}`,
            {
              token: aliceToken,
              body: { completed: true },
            },
          );
          record('Lesson progress allowed after PRE pass', allowedProgress.status === 200, allowedProgress.err);

          const surveyStart = await api<{
            attempt: { id: string };
            questions: Array<{ id: string; options: Array<{ id: string }> }>;
          }>('POST', `/assessments/${survey.data.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: enroll.data.id },
          });
          const surveyQ = surveyStart.data?.questions?.[0];
          const surveySubmit =
            surveyStart.data?.attempt?.id &&
            surveyQ &&
            (await api<{ survey?: boolean }>('POST', `/assessments/${survey.data.id}/submit`, {
              token: aliceToken,
              body: {
                enrollmentId: enroll.data.id,
                attemptId: surveyStart.data.attempt.id,
                answers: [{ questionId: surveyQ.id, optionId: surveyQ.options[0]?.id ?? '' }],
              },
            }));
          record('Survey submits without grading', surveySubmit?.status === 200, surveySubmit?.err);

          const exportRes = await fetch(`${API}/assessments/${survey.data.id}/survey-export`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
          });
          const exportText = await exportRes.text();
          record(
            'Survey CSV export',
            exportRes.ok && exportText.includes('Anonymous') && exportText.includes('How was the course?'),
            exportRes.ok ? undefined : exportText.slice(0, 120),
          );

          const modStart = await api<{
            attempt: { id: string };
            questions: Array<{ id: string; options: Array<{ id: string }> }>;
          }>('POST', `/assessments/${moduleQuiz.data!.id}/start`, {
            token: aliceToken,
            body: { enrollmentId: enroll.data.id },
          });
          const modQ = modStart.data?.questions?.[0];
          const modTrueOption = modQ?.options.find((opt) => opt.text === 'True') ?? modQ?.options[0];
          const modSubmit =
            modStart.data?.attempt?.id &&
            modQ &&
            modTrueOption &&
            (await api<{ attempt: { passed: boolean } }>(
              'POST',
              `/assessments/${moduleQuiz.data!.id}/submit`,
              {
                token: aliceToken,
                body: {
                  enrollmentId: enroll.data.id,
                  attemptId: modStart.data.attempt.id,
                  answers: [{ questionId: modQ.id, optionId: modTrueOption.id }],
                },
              },
            ));
          record('Module quiz passes', modSubmit?.data?.attempt.passed === true, modSubmit?.err);

          const progressAfterQuiz = await api<{ progress: Array<{ lessonId: string; completed: boolean }> }>(
            'GET',
            `/enrollments/${enroll.data.id}`,
            { token: aliceToken },
          );
          record(
            'Module quiz auto-completes lesson',
            progressAfterQuiz.data?.progress?.some(
              (row) => row.lessonId === quizLesson.data?.id && row.completed,
            ) === true,
            progressAfterQuiz.err,
          );
        } else {
          record('PRE gate blocks lesson progress', false, enroll.err);
          record('PRE assessment can be passed', false, 'Enroll failed');
          record('Lesson progress allowed after PRE pass', false, 'Enroll failed');
          record('Survey submits without grading', false, 'Enroll failed');
          record('Survey CSV export', false, 'Enroll failed');
          record('Module quiz passes', false, 'Enroll failed');
          record('Module quiz auto-completes lesson', false, 'Enroll failed');
        }
      } else {
        record('PRE gate blocks lesson progress', false, 'Setup failed');
        record('PRE assessment can be passed', false, 'Setup failed');
        record('Lesson progress allowed after PRE pass', false, 'Setup failed');
        record('Survey submits without grading', false, 'Setup failed');
        record('Survey CSV export', false, 'Setup failed');
        record('Module quiz passes', false, 'Setup failed');
        record('Module quiz auto-completes lesson', false, 'Setup failed');
      }

      record(
        'Duplicate module quiz blocked',
        duplicateModuleQuiz?.code === 'VALIDATION_ERROR',
        duplicateModuleQuiz?.err,
      );
      record('Create SURVEY assessment', survey.status === 201, survey.err);
      record('Create MODULE_QUIZ assessment', moduleQuiz?.status === 201, moduleQuiz?.err);

      await api('DELETE', `/courses/${phase5Course.data.id}?force=true`, { token });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} passed\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
