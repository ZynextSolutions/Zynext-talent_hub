import { z } from 'zod';
import { paginationQuerySchema } from './pagination.schema';

export const platformOrgListSchema = {
  query: paginationQuerySchema.extend({
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }),
};

export const platformCreateOrgSchema = {
  body: z.object({
    name: z.string().min(2).max(120),
    slug: z.string().min(2).max(48),
    adminEmail: z.string().email(),
    adminFirstName: z.string().min(1),
    adminLastName: z.string().min(1),
  }),
};

export const platformPatchOrgSchema = {
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    settings: z.record(z.unknown()).optional(),
  }),
};

export const platformAuditQuerySchema = {
  query: paginationQuerySchema.extend({
    organizationId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    action: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),
};

export const patchCurrentOrgSchema = {
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    logoUrl: z.string().url().nullable().optional(),
    settings: z
      .object({
        timezone: z.string().optional(),
        allowDivisionlessDepts: z.boolean().optional(),
        certificatePrefix: z.string().min(2).max(12).optional(),
        showAnswersAfterAttempt: z.boolean().optional(),
        trainingCurrency: z.enum(['USD', 'MMK']).optional(),
        defaultTrainingCostMinor: z.number().int().nonnegative().optional(),
        certificateTemplate: z
          .object({
            theme: z.enum(['midnight', 'ivory', 'slate']).optional(),
            title: z.string().min(1).max(80).optional(),
            eyebrow: z.string().max(80).optional(),
            body: z.string().max(120).optional(),
            accentColor: z.string().regex(/^#([0-9A-Fa-f]{6})$/).optional(),
            signatoryName: z.string().max(80).optional(),
            signatoryTitle: z.string().max(80).optional(),
            footerNote: z.string().max(160).optional(),
            logoUrl: z.string().max(500).optional(),
            signatureUrl: z.string().max(500).optional(),
            backgroundUrl: z.string().max(500).optional(),
            organizationName: z.string().max(120).optional(),
            textAlign: z.enum(['left', 'center', 'right']).optional(),
            fontFamily: z.enum(['serif', 'sans', 'display', 'script']).optional(),
            fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
            fontStyle: z.enum(['normal', 'italic']).optional(),
            orgNameSize: z.number().int().min(10).max(22).optional(),
            titleSize: z.number().int().min(22).max(56).optional(),
            nameSize: z.number().int().min(22).max(56).optional(),
            bodySize: z.number().int().min(11).max(22).optional(),
            courseSize: z.number().int().min(14).max(40).optional(),
          })
          .optional(),
      })
      .optional(),
  }),
};
