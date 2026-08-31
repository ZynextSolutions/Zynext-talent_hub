import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../errors/app-error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export function singleUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        next(AppError.from('VALIDATION_ERROR', 'Invalid file upload.'));
        return;
      }
      next();
    });
  };
}
