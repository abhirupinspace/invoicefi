import { NextFunction, Request, Response } from 'express';

// Wraps async route handlers so rejected promises reach the error middleware
// instead of crashing the process.
type AsyncRoute = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRoute) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
