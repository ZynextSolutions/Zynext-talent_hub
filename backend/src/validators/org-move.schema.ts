import { z } from 'zod';

export const orgTreeQuerySchema = {
  query: z.object({
    includeUsers: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v !== 'false'),
  }),
};

export const orgMoveSchema = {
  body: z.object({
    nodeType: z.enum(['DEPARTMENT', 'TEAM', 'USER']),
    nodeId: z.string().uuid(),
    targetParentType: z.enum(['ORGANIZATION', 'DIVISION', 'DEPARTMENT', 'TEAM']),
    targetParentId: z.string().uuid().optional().nullable(),
  }),
};
