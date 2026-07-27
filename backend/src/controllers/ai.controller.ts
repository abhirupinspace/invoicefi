import { Request, Response } from 'express';
import { aiChatService } from '../services/aiChat.service';
import { invoiceService } from '../services/invoice.service';
import { sendSuccess } from '../utils/apiResponse';

export class AiController {
  async query(req: Request, res: Response): Promise<void> {
    const result = await aiChatService.query(req.user!, req.body.query);
    sendSuccess(res, result);
  }

  async analyze(req: Request, res: Response): Promise<void> {
    const analysis = await invoiceService.reanalyze(req.user!, req.params.id);
    sendSuccess(res, analysis);
  }

  async price(req: Request, res: Response): Promise<void> {
    const pricing = await invoiceService.priceFor(req.user!, req.params.id);
    sendSuccess(res, pricing);
  }
}

export const aiController = new AiController();
