import { AuthUser } from './index';

// Augment Express Request with the authenticated principal set by auth
// middleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
