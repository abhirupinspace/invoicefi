import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { ACCEPTED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from '../config/constants';
import { BadRequestError } from '../utils/appError';

// In memory upload so the buffer can be hashed and forwarded to storage. Only
// PDFs within the size limit are accepted.
const handler = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_UPLOAD_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Only PDF uploads are accepted'));
    }
  },
}).single('file');

// Wrap multer so its errors become consistent AppError responses.
export function uploadPdf(req: Request, res: Response, next: NextFunction): void {
  handler(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the maximum allowed size'
          : err.message;
      return next(new BadRequestError(message));
    }
    if (err) return next(err);
    next();
  });
}
