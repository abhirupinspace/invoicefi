import { Request, Response } from 'express';
import { sendFailure } from '../utils/apiResponse';

export function notFound(req: Request, res: Response): Response {
  return sendFailure(
    res,
    404,
    'NOT_FOUND',
    `Route ${req.method} ${req.path} not found`,
  );
}
