import { Request, Response } from 'express';
import { invoiceService } from '../services/invoice.service';
import { marketplaceService } from '../services/marketplace.service';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError } from '../utils/appError';

export class InvoiceController {
  async upload(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new BadRequestError('A PDF file is required in the "file" field');
    }
    const invoice = await invoiceService.upload({
      sellerId: req.user!.id,
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      overrides: req.body,
    });
    sendSuccess(res, invoice, 201);
  }

  async list(req: Request, res: Response): Promise<void> {
    const invoices = await invoiceService.list(req.user!);
    sendSuccess(res, invoices);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const invoice = await invoiceService.getById(req.user!, req.params.id);
    sendSuccess(res, invoice);
  }

  async tokenize(req: Request, res: Response): Promise<void> {
    const invoice = await invoiceService.tokenize(req.user!, req.body.invoiceId);
    sendSuccess(res, invoice);
  }

  async listForFunding(req: Request, res: Response): Promise<void> {
    const listing = await marketplaceService.list(req.user!, req.body);
    sendSuccess(res, listing, 201);
  }
}

export const invoiceController = new InvoiceController();
