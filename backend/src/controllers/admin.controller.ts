import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { sendSuccess } from '../utils/apiResponse';

export class AdminController {
  async listInvoices(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminService.listInvoices());
  }

  async verify(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminService.verify(req.user!, req.params.id));
  }

  async reject(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminService.reject(req.user!, req.params.id, req.body?.reason));
  }

  async settle(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await adminService.settle(req.user!, req.params.id));
  }
}

export const adminController = new AdminController();
