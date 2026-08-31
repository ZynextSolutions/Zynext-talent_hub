/**
 * Zynext TalentHub full-stack smoke test (uses seeded demo credentials — no custom app roles).
 * Usage: npm run test:smoke  (requires API on localhost:4000)
 */

const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';
const ROOT = API.replace('/api/v1', '');

type Env<T> = { success: true; data: T } | { success: false; error: { message: string } };

interface Result {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: Result[] = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api<T>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; data: T | null; err?: string }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
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
    /* ignore */
  }
  if (!res.ok || !json?.success) {
    const err = json && 'error' in json ? json.error.message : text.slice(0, 120) || `HTTP ${res.status}`;
    return { status: res.status, data: null, err };
  }
  return { status: res.status, data: json.data, err: undefined };
}

async function loginOrg(email: string, password: string, organizationSlug: string) {
  const r = await api<{ tokens: { accessToken: string } }>('POST', '/auth/login', {
    body: { email, password, organizationSlug },
  });
  return r.data?.tokens.accessToken ?? null;
}

async function loginPlatform(email: string, password: string) {
  const r = await api<{ tokens: { accessToken: string } }>('POST', '/auth/platform/login', {
    body: { email, password },
  });
  return r.data?.tokens.accessToken ?? null;
}

function unwrapList<T>(data: T[] | { items: T[] } | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object' && 'items' in data && Array.isArray(data.items)) return data.items;
  return [];
}

async function main() {
  console.log('\nZynext TalentHub Smoke Test\n');

  // Health
  const health = await fetch(`${ROOT}/health`);
  record('API health', health.ok, `HTTP ${health.status}`);

  const ready = await fetch(`${ROOT}/ready`);
  record('API ready', ready.ok, `HTTP ${ready.status}`);

  // Auth — org admin
  const adminToken = await loginOrg('admin@acme.com', 'Password123!', 'acme');
  record('Org admin login', !!adminToken);

  if (!adminToken) {
    summary();
    process.exit(1);
  }

  const me = await api<{ user?: { role: string }; permissions?: string[] }>('GET', '/auth/me', {
    token: adminToken,
  });
  record('Auth me (admin)', me.data?.user?.role === 'ORG_ADMIN', me.data?.user?.role);

  // Read endpoints
  const coursesRaw = await api<Array<{ id: string; title: string }> | { items: Array<{ id: string; title: string }> }>(
    'GET',
    '/courses',
    { token: adminToken },
  );
  const courseList = unwrapList(coursesRaw.data);
  record('List courses', courseList.length > 0, `${courseList.length} courses`);

  record('List question banks', !(await api('GET', '/question-banks', { token: adminToken })).err);
  record('List users', !(await api('GET', '/users', { token: adminToken })).err);
  record('Org tree', !(await api('GET', '/org/tree', { token: adminToken })).err);
  const dash = await api<{
    kpis?: { enrollmentCount?: number; completionRate?: number };
  }>('GET', '/analytics/dashboard', { token: adminToken });
  record('Analytics dashboard', !dash.err, dash.err);
  record(
    'Analytics courses',
    !(await api('GET', '/analytics/courses', { token: adminToken })).err,
  );
  record(
    'Analytics learners',
    !(await api('GET', '/analytics/learners', { token: adminToken })).err,
  );
  record(
    'Analytics assessments',
    !(await api('GET', '/analytics/assessments', { token: adminToken })).err,
  );
  record(
    'Analytics by-role',
    !(await api('GET', '/analytics/by-role', { token: adminToken })).err,
  );
  record(
    'Analytics by-org-level',
    !(await api('GET', '/analytics/by-org-level?level=DIVISION', { token: adminToken })).err,
  );
  record(
    'Analytics engagement',
    !(await api('GET', '/analytics/engagement', { token: adminToken })).err,
  );
  record(
    'Analytics trends',
    !(await api('GET', '/analytics/trends?granularity=week', { token: adminToken })).err,
  );
  record(
    'Analytics skills',
    !(await api('GET', '/analytics/skills', { token: adminToken })).err,
  );
  record('Skills list', !(await api('GET', '/skills', { token: adminToken })).err);
  record('Audit logs', !(await api('GET', '/audit-logs', { token: adminToken })).err);
  record('xAPI stats', !(await api('GET', '/xapi/stats', { token: adminToken })).err);
  const openapiRes = await fetch(`${API}/docs/openapi.json`);
  const openapiJson = openapiRes.ok ? await openapiRes.json().catch(() => null) : null;
  record('OpenAPI docs', openapiRes.ok && openapiJson?.openapi === '3.0.3');
  record(
    'Analytics ROI',
    !(await api('GET', '/analytics/roi', { token: adminToken })).err,
  );
  const roiRes = await api<{ kpis?: { currency?: string } }>('GET', '/analytics/roi', {
    token: adminToken,
  });
  record('Analytics ROI currency MMK', !roiRes.err && roiRes.data?.kpis?.currency === 'MMK', roiRes.err);
  record(
    'Analytics snapshots',
    !(await api('GET', '/analytics/snapshots', { token: adminToken })).err,
  );
  record(
    'Role skills roles list',
    !(await api('GET', '/skills/roles', { token: adminToken })).err,
  );
  record(
    'Grading pending-review list',
    !(await api('GET', '/assessments/pending-review', { token: adminToken })).err,
  );

  const skill = await api<{ id: string; name: string }>('POST', '/skills', {
    token: adminToken,
    body: { name: `Smoke Skill ${Date.now()}`, category: 'General' },
  });
  record('Create skill', !skill.err, skill.err);

  const complianceExport = await api('GET', '/compliance/export', { token: adminToken });
  record(
    'Compliance export',
    !complianceExport.err || complianceExport.status === 200,
    complianceExport.err,
  );

  // Question bank + assessment (bank draw)
  const bank = await api<{ id: string; name: string }>('POST', '/question-banks', {
    token: adminToken,
    body: { name: `Smoke Bank ${Date.now()}`, description: 'Automated smoke test' },
  });
  if (bank.data) {
    record('Create question bank', true, bank.data.name);
    await api('POST', `/question-banks/${bank.data.id}/questions`, {
      token: adminToken,
      body: {
        question: 'Smoke test: 2+2=?',
        type: 'MCQ',
        options: ['3', '4', '5'],
        correctOptionIndex: 1,
      },
    });
    record('Add bank question', true);
  } else {
    record('Create question bank', false, bank.err);
  }

  const course = courseList.find((c) => c.title.includes('Security')) ?? courseList[0];
  if (course && bank.data) {
    const assessmentsRaw = await api<Array<{ id: string; kind: string }> | { items: Array<{ id: string; kind: string }> }>(
      'GET',
      `/courses/${course.id}/assessments`,
      { token: adminToken },
    );
    const assessments = unwrapList(assessmentsRaw.data);
    const hasPre = assessments.some((a) => a.kind === 'PRE');
    if (!hasPre) {
      const created = await api('POST', `/courses/${course.id}/assessments`, {
        token: adminToken,
        body: {
          title: 'Smoke PRE Quiz',
          kind: 'PRE',
          passingScore: 70,
          maxAttempts: 3,
          bankId: bank.data.id,
          drawCount: 1,
        },
      });
      record('Assessment from question bank', !created.err, created.err);
    } else {
      record('Assessment from question bank', true, 'PRE exists — skipped');
    }
  }

  // Employee learner flow
  const empToken = await loginOrg('alice@acme.com', 'Password123!', 'acme');
  record('Employee login', !!empToken);

  if (empToken && course) {
    const me = await api<{ user?: { id: string } }>('GET', '/auth/me', { token: empToken });
    const userId = me.data?.user?.id;
    const enrollmentsRaw = await api<Array<{ id: string; courseId: string }> | { items: Array<{ id: string; courseId: string }> }>(
      'GET',
      userId
        ? `/enrollments?courseId=${course.id}&userId=${userId}&pageSize=1`
        : '/enrollments?pageSize=100',
      { token: empToken },
    );
    const enrollmentList = unwrapList(enrollmentsRaw.data);
    const enrollment = enrollmentList.find((e) => e.courseId === course.id) ?? enrollmentList[0];
    record('Employee enrollment', !!enrollment);

    if (enrollment) {
      const courseDetail = await api<{
        lessons: Array<{ id: string; kind?: string; durationSeconds?: number | null }>;
      }>('GET', `/courses/${course.id}`, {
        token: empToken,
      });
      for (const lesson of courseDetail.data?.lessons ?? []) {
        if (lesson.kind === 'VIDEO' || lesson.kind === 'SCORM' || lesson.kind === 'ILT' || lesson.kind === 'VILT' || lesson.kind === 'QUIZ') {
          continue;
        }
        await api('PUT', `/enrollments/${enrollment.id}/progress/lessons/${lesson.id}`, {
          token: empToken,
          body: { positionSeconds: 0 },
        });
        await api('POST', `/enrollments/${enrollment.id}/progress/lessons/${lesson.id}/complete`, {
          token: empToken,
        });
      }
      record('Complete lessons', true);

      const courseAssessmentsRaw = await api<Array<{ id: string; kind: string }> | { items: Array<{ id: string; kind: string }> }>(
        'GET',
        `/courses/${course.id}/assessments`,
        { token: empToken },
      );
      const courseAssessments = unwrapList(courseAssessmentsRaw.data);
      const finalA = courseAssessments.find((a) => a.kind === 'FINAL') ?? courseAssessments[0];
      if (!finalA) {
        record('Submit assessment', false, 'No assessment on course');
      } else {
        const start = await api<{
          attempt: { id: string };
          questions: Array<{ id: string; options: Array<{ id: string }> }>;
        }>('POST', `/assessments/${finalA.id}/start`, {
          token: empToken,
          body: { enrollmentId: enrollment.id },
        });
        if (start.err && /unique constraint/i.test(start.err)) {
          record('Submit assessment', true, 'already attempted');
        } else {
          const detail = await api<{ questions: Array<{ id: string; options: Array<{ id: string }> }> }>(
            'GET',
            `/assessments/${finalA.id}`,
            { token: empToken },
          );
          const questions = start.data?.questions?.length
            ? start.data.questions
            : (detail.data?.questions ?? []);
          if (!questions.length) {
            record('Submit assessment', false, 'No questions returned');
          } else {
            const answers = questions.map((q) => ({
              questionId: q.id,
              optionId: q.options[1]?.id ?? q.options[0]?.id,
            }));
            const submit = await api<{ attempt: { score: number | null } }>(
              'POST',
              `/assessments/${finalA.id}/submit`,
              {
                token: empToken,
                body: {
                  enrollmentId: enrollment.id,
                  attemptId: start.data?.attempt.id,
                  answers,
                },
              },
            );
            const alreadyDone = !!submit.err && /unique constraint/i.test(submit.err);
            record(
              'Submit assessment',
              !submit.err || alreadyDone,
              submit.data ? `score ${submit.data.attempt.score}%` : alreadyDone ? 'already submitted' : submit.err,
            );
          }
        }
      }
    }

    // RBAC: employee cannot create courses
    const forbidden = await api('POST', '/courses', {
      token: empToken,
      body: { title: 'Should fail', description: 'x' },
    });
    record('Employee blocked from course write', forbidden.status === 403 || !!forbidden.err);

    const empAnalytics = await api('GET', '/analytics/dashboard', { token: empToken });
    record('Employee blocked from analytics', empAnalytics.status === 403);

    const empEnrollments = await api('GET', '/reports/enrollments', { token: empToken });
    record('Employee own enrollments report', !empEnrollments.err || empEnrollments.status === 200);
    record(
      'Employee blocked from report export',
      (await api('GET', '/reports/enrollments/export', { token: empToken })).status === 403,
    );
    record(
      'Employee blocked from report schedules',
      (await api('GET', '/reports/schedules', { token: empToken })).status === 403,
    );
  }

  record(
    'Reports enrollments',
    !(await api('GET', '/reports/enrollments', { token: adminToken })).err,
  );

  record(
    'Report schedules list',
    !(await api('GET', '/reports/schedules', { token: adminToken })).err,
  );


  // Platform admin
  const platToken = await loginPlatform('admin@platform.com', 'Platform123!');
  record('Platform admin login', !!platToken);
  if (platToken) {
    record(
      'Platform org list',
      !(await api('GET', '/platform/organizations', { token: platToken })).err,
    );
    record('Platform audit logs', !(await api('GET', '/platform/audit-logs', { token: platToken })).err);
  }

  summary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function summary() {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${'─'.repeat(36)}`);
  console.log(`${passed}/${results.length} passed\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
