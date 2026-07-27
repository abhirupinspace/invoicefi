import { Request, Response } from 'express';
import { portfolioService } from '../services/portfolio.service';
import { sendSuccess } from '../utils/apiResponse';

export class PortfolioController {
  async holdings(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await portfolioService.holdings(req.user!));
  }

  async history(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await portfolioService.history(req.user!));
  }

  async returns(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await portfolioService.returns(req.user!));
  }
}

export const portfolioController = new PortfolioController();
