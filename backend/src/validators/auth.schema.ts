import { z } from 'zod';
import { SLUG_RE } from '../config/constants';

const adminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

export const registerSchema = {
  body: z.object({
    organizationName: z.string().min(2).max(120),
    organizationSlug: z.string().regex(SLUG_RE),
    admin: adminSchema,
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    organizationSlug: z.string().min(1),
  }),
};

export const platformLoginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }),
};

export const logoutSchema = {
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }),
};

export const patchMeSchema = {
  body: z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    avatarUrl: z.string().url().nullable().optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12).max(128),
    revokeOthers: z.boolean().optional(),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email(),
    organizationSlug: z.string().min(1),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(10),
    newPassword: z.string().min(12).max(128),
  }),
};

export const acceptInviteSchema = {
  body: z.object({
    token: z.string().min(10),
    password: z.string().min(12).max(128),
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
  }),
};
