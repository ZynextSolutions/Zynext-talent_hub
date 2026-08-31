import { Router } from 'express';
import { mediaController } from '../controllers/media.controller';

export const mediaRouter = Router();

mediaRouter.get('/*', mediaController.serve);
