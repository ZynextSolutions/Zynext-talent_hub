import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_SECRET_PREVIOUS: z.string().optional(),
    JWT_ISS: z.string().min(1),
    JWT_AUD: z.string().min(1),
    JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SEC: z.coerce.number().int().positive().default(604800),
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
    CORS_ORIGINS: z.string().min(1),
    REDIS_URL: z.string().optional(),
    PUBLIC_WEB_URL: z.string().optional(),
    NEXT_PUBLIC_WEB_URL: z.string().optional(),
    API_PUBLIC_URL: z.string().min(1).default('http://localhost:4000'),
    LOG_LEVEL: z.string().default('info'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    JOB_SECRET: z.string().optional(),
    ALLOW_PUBLIC_ORG_REGISTER: z.enum(['true', 'false']).optional(),
    ALLOW_QUERY_ACCESS_TOKEN: z.enum(['true', 'false']).optional(),
    ENCRYPTION_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.JWT_ACCESS_SECRET === val.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
        path: ['JWT_REFRESH_SECRET'],
      });
    }
    if (val.NODE_ENV === 'production' && val.BCRYPT_ROUNDS < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'BCRYPT_ROUNDS must be >= 12 in production',
        path: ['BCRYPT_ROUNDS'],
      });
    }
    if (val.NODE_ENV === 'production' && (!val.JOB_SECRET || val.JOB_SECRET.length < 16)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JOB_SECRET is required (min 16 chars) in production',
        path: ['JOB_SECRET'],
      });
    }
    if (val.NODE_ENV === 'production' && !val.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL is required in production',
        path: ['REDIS_URL'],
      });
    }
    if (val.NODE_ENV === 'production' && !val.ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ENCRYPTION_KEY is required in production',
        path: ['ENCRYPTION_KEY'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const present = {
    PORT: Boolean(process.env.PORT),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    JWT_ACCESS_SECRET: Boolean(process.env.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: Boolean(process.env.JWT_REFRESH_SECRET),
    JWT_ISS: Boolean(process.env.JWT_ISS),
    JWT_AUD: Boolean(process.env.JWT_AUD),
    CORS_ORIGINS: Boolean(process.env.CORS_ORIGINS),
    REDIS_URL: Boolean(process.env.REDIS_URL),
    JOB_SECRET: Boolean(process.env.JOB_SECRET),
    ENCRYPTION_KEY: Boolean(process.env.ENCRYPTION_KEY),
  };
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors, present);
  process.exit(1);
}

const data = parsed.data;
const isProd = data.NODE_ENV === 'production';

export const env = {
  ...data,
  isProd,
  isDev: data.NODE_ENV === 'development',
  corsOrigins: data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  PUBLIC_WEB_URL: data.PUBLIC_WEB_URL ?? data.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  publicWebUrl: data.PUBLIC_WEB_URL ?? data.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',
  allowPublicOrgRegister:
    data.ALLOW_PUBLIC_ORG_REGISTER === 'true' ||
    (data.ALLOW_PUBLIC_ORG_REGISTER !== 'false' && !isProd),
  allowQueryAccessToken:
    data.ALLOW_QUERY_ACCESS_TOKEN === 'true' ||
    (data.ALLOW_QUERY_ACCESS_TOKEN !== 'false' && !isProd),
};

export const corsOrigins = env.corsOrigins;
