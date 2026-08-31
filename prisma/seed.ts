import {
  PrismaClient,
  AssignmentTargetType,
  CourseStatus,
  EnrollmentStatus,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';
import { extractScormPackage } from '../backend/src/lib/scorm-package';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { resource: 'org', action: 'read', description: 'View organization' },
  { resource: 'org', action: 'write', description: 'Edit organization' },
  { resource: 'org', action: 'move', description: 'Move org nodes' },
  { resource: 'org', action: 'tree:read', description: 'View org tree' },
  { resource: 'user', action: 'read', description: 'View users' },
  { resource: 'user', action: 'write', description: 'Manage users' },
  { resource: 'user', action: 'invite', description: 'Invite users' },
  { resource: 'course', action: 'read', description: 'View courses' },
  { resource: 'course', action: 'write', description: 'Manage courses' },
  { resource: 'course', action: 'assign', description: 'Assign courses' },
  { resource: 'enrollment', action: 'read', description: 'View enrollments' },
  { resource: 'progress', action: 'write', description: 'Update progress' },
  { resource: 'assessment', action: 'write', description: 'Manage assessments' },
  { resource: 'assessment', action: 'grade', description: 'Grade assessments' },
  { resource: 'question-bank', action: 'write', description: 'Manage question banks' },
  { resource: 'learning-path', action: 'write', description: 'Manage learning paths' },
  { resource: 'certificate', action: 'read', description: 'View certificates' },
  { resource: 'certificate', action: 'revoke', description: 'Revoke certificates' },
  { resource: 'analytics', action: 'read', description: 'View analytics' },
  { resource: 'compliance', action: 'read', description: 'View compliance analytics and overdue reports' },
  { resource: 'compliance', action: 'export', description: 'Export regulatory compliance packages' },
  { resource: 'skills', action: 'read', description: 'View skills inventory and analytics' },
  { resource: 'skills', action: 'write', description: 'Manage skills and course mappings' },
  { resource: 'audit', action: 'read', description: 'View tenant audit logs' },
  { resource: 'xapi', action: 'read', description: 'View xAPI learning statements' },
  { resource: 'api-key', action: 'write', description: 'Manage BI API keys' },
  { resource: 'webhook', action: 'write', description: 'Manage outbound webhooks' },
  { resource: 'reports', action: 'read', description: 'View standard reports' },
  { resource: 'reports', action: 'read:own', description: 'View own enrollment and certificate reports' },
  { resource: 'reports', action: 'export', description: 'Export reports to CSV/PDF/Excel' },
  { resource: 'reports', action: 'schedule', description: 'Schedule automated report delivery' },
  { resource: 'platform', action: 'org:read', description: 'Platform view orgs' },
  { resource: 'platform', action: 'org:write', description: 'Platform manage orgs' },
];

const DEMO_VIDEOS = {
  course:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  lessons: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  ],
};

async function ensureLessonKinds(
  courseId: string,
  kinds: Record<string, 'VIDEO' | 'READING' | 'DOCUMENT' | 'QUIZ' | 'DISCUSSION'>,
) {
  const lessons = await prisma.lesson.findMany({ where: { courseId } });
  await Promise.all(
    lessons.map((lesson) => {
      const kind = kinds[lesson.title];
      if (!kind) return Promise.resolve();
      const extras =
        lesson.title === 'Phishing'
          ? {
              content:
                'Phishing is a fraudulent attempt to obtain sensitive information. Look for unexpected senders, urgent language, and links that do not match the real domain.',
            }
          : lesson.title === 'Passwords'
            ? {
                content:
                  '1. Why is a passphrase stronger than a short password?\n2. Should you reuse a work password on personal sites?\n3. What should you do if you suspect a credential leak?',
              }
            : lesson.title === 'Delegation'
              ? {
                  content:
                    'Describe a task you would delegate this week. Who would you give it to, and how would you check progress without micromanaging?',
                }
              : {};
      return prisma.lesson.update({ where: { id: lesson.id }, data: { kind, ...extras } });
    }),
  );
}

async function ensureCourseOutline(
  organizationId: string,
  courseId: string,
  weeks: Array<{ title: string; lessonTitles: string[] }>,
) {
  const existing = await prisma.courseModule.count({ where: { courseId } });
  if (existing > 0) return;
  const lessons = await prisma.lesson.findMany({
    where: { courseId },
    orderBy: { orderIndex: 'asc' },
  });
  for (const [index, week] of weeks.entries()) {
    const module = await prisma.courseModule.create({
      data: { organizationId, courseId, title: week.title, orderIndex: index },
    });
    const matched = lessons.filter((lesson) => week.lessonTitles.includes(lesson.title));
    await Promise.all(
      matched.map((lesson) =>
        prisma.lesson.update({ where: { id: lesson.id }, data: { moduleId: module.id } }),
      ),
    );
  }
}

async function ensureLessonVideos(
  lessons: Array<{ id: string; videoUrl: string | null }>,
) {
  await Promise.all(
    lessons.map((lesson, index) => {
      const nextUrl = DEMO_VIDEOS.lessons[index] ?? DEMO_VIDEOS.course;
      if (lesson.videoUrl && !lesson.videoUrl.includes('/embed/instructor')) {
        return Promise.resolve();
      }
      return prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          videoUrl: nextUrl,
          ...(lesson.videoUrl ? {} : { durationSeconds: 180 }),
        },
      });
    }),
  );
}

function resolveBackendDir(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'src', 'index.ts'))) return cwd;
  return path.join(cwd, 'backend');
}

function createDemoScormZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    'imsmanifest.xml',
    Buffer.from(`<?xml version="1.0"?>
<manifest identifier="COR_DEMO_SCORM" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <organizations default="ORG">
    <organization identifier="ORG">
      <title>Workplace Conversations</title>
      <item identifier="ITEM" identifierref="RES" isvisible="true"><title>Workplace Conversations</title></item>
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
    Buffer.from(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Workplace Conversations</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; line-height: 1.5; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Workplace Conversations</h1>
  <p>This is a seeded demo SCORM 1.2 module. Use the button below to simulate completion.</p>
  <button type="button" onclick="markComplete()">Mark complete</button>
  <script>
    function markComplete() {
      var api = window.parent && window.parent.API;
      if (!api) { alert('SCORM API not available.'); return; }
      api.LMSSetValue('cmi.core.lesson_status', 'completed');
      api.LMSCommit('');
      alert('Progress saved.');
    }
  </script>
</body>
</html>`),
  );
  return zip.toBuffer();
}

async function extractDemoScormPackage(
  organizationId: string,
  courseId: string,
  buffer: Buffer,
) {
  const repoRoot = process.cwd();
  const backendDir = resolveBackendDir();
  process.chdir(backendDir);
  try {
    return await extractScormPackage(organizationId, courseId, buffer);
  } finally {
    process.chdir(repoRoot);
  }
}

async function ensureScormDemoCourse(
  organizationId: string,
  createdByUserId: string,
  enrollUserIds: string[],
) {
  const courseTitle = 'Workplace Conversations (SCORM)';
  let course = await prisma.course.findFirst({
    where: { organizationId, title: courseTitle, deletedAt: null },
    include: { lessons: { orderBy: { orderIndex: 'asc' } } },
  });

  if (!course) {
    course = await prisma.course.create({
      data: {
        organizationId,
        title: courseTitle,
        description: 'Demo SCORM 1.2 module for testing upload, launch, and completion tracking.',
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        createdByUserId,
      },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  if (!course.scormPackageUrl?.startsWith('/uploads/scorm/')) {
    const extracted = await extractDemoScormPackage(
      organizationId,
      course.id,
      createDemoScormZip(),
    );

    course = await prisma.course.update({
      where: { id: course.id },
      data: {
        scormPackageUrl: extracted.packageUrl,
        scormVersion: extracted.version,
      },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });

    const existingScormLesson = course.lessons.find((lesson) => lesson.kind === 'SCORM');
    if (existingScormLesson) {
      await prisma.lesson.update({
        where: { id: existingScormLesson.id },
        data: {
          title: extracted.title,
          resourceUrl: extracted.packageUrl,
          kind: 'SCORM',
        },
      });
    } else {
      await prisma.lesson.create({
        data: {
          organizationId,
          courseId: course.id,
          title: extracted.title,
          description: 'Imported SCORM package',
          kind: 'SCORM',
          content: '',
          resourceUrl: extracted.packageUrl,
          orderIndex: 0,
          required: true,
        },
      });
    }

    course = await prisma.course.findFirstOrThrow({
      where: { id: course.id },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });

    await ensureCourseOutline(organizationId, course.id, [
      { title: 'SCORM module', lessonTitles: [extracted.title] },
    ]);
  }

  for (const userId of enrollUserIds) {
    await prisma.enrollment.upsert({
      where: {
        organizationId_userId_courseId: {
          organizationId,
          userId,
          courseId: course.id,
        },
      },
      create: {
        organizationId,
        userId,
        courseId: course.id,
        status: EnrollmentStatus.ENROLLED,
      },
      update: {},
    });
  }

  return course;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ORG_ADMIN: PERMISSIONS.map((p) => `${p.resource}:${p.action}`),
  MANAGER: [
    'org:read', 'org:tree:read', 'user:read', 'user:write', 'user:invite',
    'course:read', 'course:assign', 'enrollment:read', 'analytics:read', 'compliance:read', 'compliance:export',
    'skills:read', 'audit:read', 'xapi:read',
    'reports:read', 'reports:export', 'reports:schedule', 'certificate:read',
  ],
  INSTRUCTOR: [
    'org:read', 'org:tree:read', 'course:read', 'course:write', 'course:assign',
    'enrollment:read', 'assessment:read', 'analytics:read', 'skills:read', 'xapi:read',
    'reports:read', 'certificate:read',
  ],
  EMPLOYEE: [
    'org:read', 'course:read', 'enrollment:read', 'progress:write',
    'assessment:read', 'assessment:submit', 'certificate:read', 'reports:read:own',
  ],
};

async function seedPermissions() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      create: p,
      update: { description: p.description },
    });
  }
}

async function seedRolesForOrg(organizationId: string) {
  const roles: Record<string, string> = {};
  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name_organizationId: { name: roleName, organizationId } },
      create: { name: roleName, organizationId, isSystem: true },
      update: {},
    });
    roles[roleName] = role.id;

    const permKeys = ROLE_PERMISSIONS[roleName];
    for (const key of permKeys) {
      const [resource, ...actionParts] = key.split(':');
      const action = actionParts.join(':');
      const permission = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
    }
  }
  return roles;
}

async function findOrCreateDivision(organizationId: string, name: string) {
  const existing = await prisma.division.findFirst({
    where: { organizationId, name, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.division.create({ data: { organizationId, name } });
}

async function findOrCreateDepartment(
  organizationId: string,
  divisionId: string,
  name: string,
) {
  const existing = await prisma.department.findFirst({
    where: { organizationId, divisionId, name, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.department.create({ data: { organizationId, divisionId, name } });
}

async function findOrCreateTeam(organizationId: string, departmentId: string, name: string) {
  const existing = await prisma.team.findFirst({
    where: { organizationId, departmentId, name, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.team.create({ data: { organizationId, departmentId, name } });
}

async function upsertOrgUser(
  organizationId: string,
  email: string,
  data: {
    roleId: string;
    teamId: string;
    departmentId: string;
    divisionId: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  },
) {
  return prisma.user.upsert({
    where: { organizationId_email: { organizationId, email } },
    create: {
      organizationId,
      email,
      status: UserStatus.ACTIVE,
      ...data,
    },
    update: {
      roleId: data.roleId,
      teamId: data.teamId,
      departmentId: data.departmentId,
      divisionId: data.divisionId,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash: data.passwordHash,
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
      mfaSecret: null,
      mfaSecretPending: null,
    },
  });
}

async function seedOrganization(
  name: string,
  slug: string,
  adminEmail: string,
) {
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const org = await prisma.organization.upsert({
    where: { slug },
    create: { name, slug },
    update: { name },
  });

  const roles = await seedRolesForOrg(org.id);

  const division = await findOrCreateDivision(org.id, 'Operations');

  const deptEng = await findOrCreateDepartment(org.id, division.id, 'Engineering');

  const deptHr = await findOrCreateDepartment(org.id, division.id, 'Human Resources');

  const teamBackend = await findOrCreateTeam(org.id, deptEng.id, 'Backend Team');

  const teamFrontend = await findOrCreateTeam(org.id, deptEng.id, 'Frontend Team');

  const teamHr = await findOrCreateTeam(org.id, deptHr.id, 'HR Operations');
  void teamHr;

  const admin = await upsertOrgUser(org.id, adminEmail, {
    roleId: roles.ORG_ADMIN,
    teamId: teamBackend.id,
    departmentId: deptEng.id,
    divisionId: division.id,
    passwordHash,
    firstName: 'Org',
    lastName: 'Admin',
  });

  const manager = await upsertOrgUser(org.id, `manager@${slug}.com`, {
    roleId: roles.MANAGER,
    teamId: teamBackend.id,
    departmentId: deptEng.id,
    divisionId: division.id,
    passwordHash,
    firstName: 'Team',
    lastName: 'Manager',
  });

  const instructor = await upsertOrgUser(org.id, `instructor@${slug}.com`, {
    roleId: roles.INSTRUCTOR,
    teamId: teamFrontend.id,
    departmentId: deptEng.id,
    divisionId: division.id,
    passwordHash,
    firstName: 'Course',
    lastName: 'Instructor',
  });

  const employees = await Promise.all(
    ['alice', 'bob', 'carol'].map((name) =>
      upsertOrgUser(org.id, `${name}@${slug}.com`, {
        roleId: roles.EMPLOYEE,
        teamId: teamFrontend.id,
        departmentId: deptEng.id,
        divisionId: division.id,
        passwordHash,
        firstName: name.charAt(0).toUpperCase() + name.slice(1),
        lastName: 'Employee',
      }),
    ),
  );

  let course1 = await prisma.course.findFirst({
    where: { organizationId: org.id, title: 'Security Awareness Training', deletedAt: null },
    include: { lessons: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!course1) {
    course1 = await prisma.course.create({
      data: {
        organizationId: org.id,
        title: 'Security Awareness Training',
        description: 'Essential security practices for all employees.',
        videoUrl: DEMO_VIDEOS.course,
        status: CourseStatus.PUBLISHED,
        lessons: {
          create: [
            {
              organizationId: org.id,
              title: 'Introduction',
              kind: 'VIDEO',
              content: 'Welcome to security training.',
              videoUrl: DEMO_VIDEOS.lessons[0],
              durationSeconds: 180,
              orderIndex: 0,
            },
            {
              organizationId: org.id,
              title: 'Phishing',
              kind: 'READING',
              content: 'How to identify phishing emails.',
              durationSeconds: 180,
              orderIndex: 1,
            },
            {
              organizationId: org.id,
              title: 'Passwords',
              kind: 'QUIZ',
              content: 'Best practices for passwords.',
              durationSeconds: 180,
              orderIndex: 2,
            },
          ],
        },
      },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  let course2 = await prisma.course.findFirst({
    where: { organizationId: org.id, title: 'Leadership Fundamentals', deletedAt: null },
    include: { lessons: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!course2) {
    course2 = await prisma.course.create({
      data: {
        organizationId: org.id,
        title: 'Leadership Fundamentals',
        description: 'Core leadership skills for managers.',
        status: CourseStatus.PUBLISHED,
        lessons: {
          create: [
            {
              organizationId: org.id,
              title: 'Communication',
              kind: 'READING',
              content: 'Effective communication.',
              durationSeconds: 180,
              orderIndex: 0,
            },
            {
              organizationId: org.id,
              title: 'Delegation',
              kind: 'DISCUSSION',
              content: 'How to delegate effectively.',
              durationSeconds: 180,
              orderIndex: 1,
            },
          ],
        },
      },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  if (course1.videoUrl?.includes('/embed/instructor') || !course1.videoUrl) {
    course1 = await prisma.course.update({
      where: { id: course1.id },
      data: { videoUrl: DEMO_VIDEOS.course },
      include: { lessons: { orderBy: { orderIndex: 'asc' } } },
    });
  }
  await ensureLessonVideos(course1.lessons);
  await ensureLessonVideos(course2.lessons);
  await ensureCourseOutline(org.id, course1.id, [
    { title: 'Week 1: Foundations', lessonTitles: ['Introduction'] },
    { title: 'Week 2: Social engineering', lessonTitles: ['Phishing'] },
    { title: 'Week 3: Access control', lessonTitles: ['Passwords'] },
  ]);
  await ensureCourseOutline(org.id, course2.id, [
    { title: 'Week 1: Working with people', lessonTitles: ['Communication'] },
    { title: 'Week 2: Getting work done', lessonTitles: ['Delegation'] },
  ]);
  await ensureLessonKinds(course1.id, {
    Introduction: 'VIDEO',
    Phishing: 'READING',
    Passwords: 'QUIZ',
  });
  await ensureLessonKinds(course2.id, {
    Communication: 'READING',
    Delegation: 'DISCUSSION',
  });

  const scormCourse = await ensureScormDemoCourse(
    org.id,
    instructor.id,
    employees.map((user) => user.id),
  );

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { organizationId: org.id, title: 'Welcome to Acme Learning' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        organizationId: org.id,
        title: 'Welcome to Acme Learning',
        body: 'Check the catalog for new courses and join discussions in Community.',
        publishedAt: new Date(),
        createdByUserId: admin.id,
      },
    });
  }

  let iltLesson = course2.lessons.find((lesson) => lesson.title === 'Team workshop');
  if (!iltLesson) {
    iltLesson = await prisma.lesson.create({
      data: {
        organizationId: org.id,
        courseId: course2.id,
        title: 'Team workshop',
        kind: 'ILT',
        content: 'In-person leadership workshop with your cohort.',
        durationSeconds: 3600,
        orderIndex: course2.lessons.length,
      },
    });
  }

  const existingSession = await prisma.trainingSession.findFirst({
    where: { organizationId: org.id, courseId: course2.id, lessonId: iltLesson.id },
  });
  if (!existingSession) {
    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    startsAt.setHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    await prisma.trainingSession.create({
      data: {
        organizationId: org.id,
        courseId: course2.id,
        lessonId: iltLesson.id,
        title: 'Leadership workshop — cohort A',
        description: 'Room 204, building B',
        deliveryMode: 'ILT',
        startsAt,
        endsAt,
        timezone: 'America/New_York',
        location: 'HQ — Conference Room 204',
        capacity: 20,
        instructorUserId: instructor.id,
      },
    });
  }

  const existingAssessment = await prisma.assessment.findFirst({
    where: { organizationId: org.id, courseId: course1.id, title: 'Security Quiz' },
  });
  if (!existingAssessment) {
    await prisma.assessment.create({
      data: {
        organizationId: org.id,
        courseId: course1.id,
        title: 'Security Quiz',
        passingScore: 70,
        questions: {
          create: [
            {
              question: 'What is phishing?',
              options: [
                { id: 'a', text: 'A type of fishing' },
                { id: 'b', text: 'Fraudulent attempt to obtain sensitive information' },
                { id: 'c', text: 'A computer virus' },
              ],
              correctOptionId: 'b',
              orderIndex: 0,
            },
          ],
        },
      },
    });
  }

  await prisma.courseAssignment.upsert({
    where: {
      organizationId_courseId_targetType_targetId: {
        organizationId: org.id,
        courseId: course1.id,
        targetType: AssignmentTargetType.DEPARTMENT,
        targetId: deptEng.id,
      },
    },
    create: {
      organizationId: org.id,
      courseId: course1.id,
      targetType: AssignmentTargetType.DEPARTMENT,
      targetId: deptEng.id,
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      recertifyEveryDays: 365,
      reminderDaysBefore: 7,
    },
    update: {
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      recertifyEveryDays: 365,
      reminderDaysBefore: 7,
    },
  });

  const existingBank = await prisma.questionBank.findFirst({
    where: { organizationId: org.id, name: 'Security question pool' },
  });
  if (!existingBank) {
    await prisma.questionBank.create({
      data: {
        organizationId: org.id,
        name: 'Security question pool',
        description: 'Randomized security awareness questions',
        questions: {
          create: [
            {
              question: 'Which is a strong password practice?',
              type: 'MCQ',
              options: [
                { id: 'a', text: 'Reuse passwords' },
                { id: 'b', text: 'Use a unique password per site' },
              ],
              correctOptionId: 'b',
            },
            {
              question: 'Phishing emails always contain spelling errors.',
              type: 'TRUE_FALSE',
              options: [
                { id: 't', text: 'True' },
                { id: 'f', text: 'False' },
              ],
              correctOptionId: 'f',
            },
          ],
        },
      },
    });
  }

  const existingPath = await prisma.learningPath.findFirst({
    where: { organizationId: org.id, title: 'New hire onboarding' },
  });
  if (!existingPath) {
    await prisma.learningPath.create({
      data: {
        organizationId: org.id,
        title: 'New hire onboarding',
        description: 'Security then leadership fundamentals',
        status: 'PUBLISHED',
        courses: {
          create: [
            { courseId: course1.id, orderIndex: 0, required: true },
            { courseId: course2.id, orderIndex: 1, required: true },
          ],
        },
      },
    });
  }

  const allUsers = [admin, manager, instructor, ...employees];
  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  for (const user of allUsers) {
    const enrollment = await prisma.enrollment.upsert({
      where: {
        organizationId_userId_courseId: {
          organizationId: org.id,
          userId: user.id,
          courseId: course1.id,
        },
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        courseId: course1.id,
        status: EnrollmentStatus.IN_PROGRESS,
        dueAt,
        progressPct: user.email.includes('alice') ? 66 : 33,
      },
      update: { dueAt },
    });

    const completedLessons = course1.lessons.slice(0, user.email.includes('alice') ? 2 : 1);
    for (const lesson of completedLessons) {
      await prisma.progress.upsert({
        where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
        create: {
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          completed: true,
          percentage: 100,
        },
        update: { completed: true, percentage: 100 },
      });
    }
  }

  const year = new Date().getUTCFullYear();
  const prefix = slug.replace(/[^a-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const alice = employees.find((u) => u.email.startsWith('alice@'));
  if (alice) {
    await seedCourseCertificate({
      organizationId: org.id,
      userId: alice.id,
      courseId: course1.id,
      lessons: course1.lessons,
      certificateNumber: `COR-${year}-${prefix}ALIC`,
      issuedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    });
  }
  await seedCourseCertificate({
    organizationId: org.id,
    userId: manager.id,
    courseId: course1.id,
    lessons: course1.lessons,
    certificateNumber: `COR-${year - 1}-${prefix}MGR1`,
    issuedAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
  });
  const bob = employees.find((u) => u.email.startsWith('bob@'));
  if (bob) {
    await seedCourseCertificate({
      organizationId: org.id,
      userId: bob.id,
      courseId: course2.id,
      lessons: course2.lessons,
      certificateNumber: `COR-${year}-${prefix}BOB1`,
      issuedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      revokedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    });
  }

  await seedPhase4Demo(org.id, roles);

  return { org, admin, courses: [course1, course2, scormCourse] };
}

async function seedPhase4Demo(organizationId: string, roles: Record<string, string>) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: true } });
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      settings: {
        ...settings,
        trainingCurrency: 'MMK',
        defaultTrainingCostMinor: 50_000,
      },
    },
  });

  await prisma.course.updateMany({
    where: { organizationId, title: 'Security Awareness Training' },
    data: { costCents: 75_000 },
  });
  await prisma.course.updateMany({
    where: { organizationId, title: 'Leadership Fundamentals' },
    data: { costCents: 150_000 },
  });

  const securitySkill = await prisma.skill.upsert({
    where: { organizationId_name: { organizationId, name: 'Security awareness' } },
    create: { organizationId, name: 'Security awareness', code: 'SEC-101', category: 'Security' },
    update: {},
  });
  const leadershipSkill = await prisma.skill.upsert({
    where: { organizationId_name: { organizationId, name: 'Team leadership' } },
    create: { organizationId, name: 'Team leadership', code: 'LEAD-101', category: 'Leadership' },
    update: {},
  });

  const securityCourse = await prisma.course.findFirst({
    where: { organizationId, title: 'Security Awareness Training' },
  });
  if (securityCourse) {
    await prisma.courseSkill.deleteMany({ where: { courseId: securityCourse.id } });
    await prisma.courseSkill.create({
      data: { courseId: securityCourse.id, skillId: securitySkill.id, level: 2 },
    });
  }

  const employeeRoleId = roles.EMPLOYEE;
  const managerRoleId = roles.MANAGER;
  if (employeeRoleId) {
    await prisma.roleSkill.deleteMany({ where: { roleId: employeeRoleId } });
    await prisma.roleSkill.create({
      data: { roleId: employeeRoleId, skillId: securitySkill.id, requiredLevel: 1 },
    });
  }
  if (managerRoleId) {
    await prisma.roleSkill.deleteMany({ where: { roleId: managerRoleId } });
    await prisma.roleSkill.createMany({
      data: [
        { roleId: managerRoleId, skillId: securitySkill.id, requiredLevel: 1 },
        { roleId: managerRoleId, skillId: leadershipSkill.id, requiredLevel: 2 },
      ],
    });
  }
}

async function seedCourseCertificate(params: {
  organizationId: string;
  userId: string;
  courseId: string;
  lessons: { id: string }[];
  certificateNumber: string;
  issuedAt: Date;
  revokedAt?: Date | null;
}) {
  const enrollment = await prisma.enrollment.upsert({
    where: {
      organizationId_userId_courseId: {
        organizationId: params.organizationId,
        userId: params.userId,
        courseId: params.courseId,
      },
    },
    create: {
      organizationId: params.organizationId,
      userId: params.userId,
      courseId: params.courseId,
      status: EnrollmentStatus.COMPLETED,
      progressPct: 100,
      completedAt: params.issuedAt,
    },
    update: {
      status: EnrollmentStatus.COMPLETED,
      progressPct: 100,
      completedAt: params.issuedAt,
    },
  });

  for (const lesson of params.lessons) {
    await prisma.progress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } },
      create: {
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        completed: true,
        percentage: 100,
        completedAt: params.issuedAt,
      },
      update: { completed: true, percentage: 100, completedAt: params.issuedAt },
    });
  }

  await prisma.certificate.upsert({
    where: { enrollmentId: enrollment.id },
    create: {
      organizationId: params.organizationId,
      enrollmentId: enrollment.id,
      userId: params.userId,
      courseId: params.courseId,
      certificateNumber: params.certificateNumber,
      issuedAt: params.issuedAt,
      revokedAt: params.revokedAt ?? null,
    },
    update: {
      certificateNumber: params.certificateNumber,
      issuedAt: params.issuedAt,
      revokedAt: params.revokedAt ?? null,
    },
  });
}

async function main() {
  console.log('Seeding database...');
  await seedPermissions();

  await prisma.platformAdmin.upsert({
    where: { email: 'admin@platform.com' },
    create: {
      email: 'admin@platform.com',
      passwordHash: await bcrypt.hash('Platform123!', 12),
      firstName: 'Platform',
      lastName: 'Admin',
    },
    update: {},
  });

  await seedOrganization('Acme Corp', 'acme', 'admin@acme.com');
  await seedOrganization('Globex Inc', 'globex', 'admin@globex.com');

  console.log('Seed complete.');
  console.log('Platform admin: admin@platform.com / Platform123!');
  console.log('Org admin: admin@acme.com / Password123!');
  console.log('SCORM demo: Workplace Conversations (SCORM) — enrolled for alice@, bob@, carol@');
  console.log(`Certificates: COR-${new Date().getUTCFullYear()}-ACMEALIC (Alice, valid)`);
  console.log(`              COR-${new Date().getUTCFullYear() - 1}-ACMEMGR1 (Manager, expiring)`);
  console.log(`              COR-${new Date().getUTCFullYear()}-ACMEBOB1 (Bob, revoked)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
