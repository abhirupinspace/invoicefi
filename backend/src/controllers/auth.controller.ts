import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';

// Thin controllers: read validated input, call the service, shape the response.
export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 201);
  }

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body);
    sendSuccess(res, result);
  }

  async profile(req: Request, res: Response): Promise<void> {
    // authenticate middleware guarantees req.user is present.
    const user = await authService.profile(req.user!.id);
    sendSuccess(res, user);
  }
}

export const authController = new AuthController();
