import { Request, Response } from 'express';
import { marketplaceService } from '../services/marketplace.service';
import { sendSuccess } from '../utils/apiResponse';

export class MarketplaceController {
  async getAll(_req: Request, res: Response): Promise<void> {
    const listings = await marketplaceService.getListings();
    sendSuccess(res, listings);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const listing = await marketplaceService.getListing(req.params.id);
    sendSuccess(res, listing);
  }

  async list(req: Request, res: Response): Promise<void> {
    const listing = await marketplaceService.list(req.user!, req.body);
    sendSuccess(res, listing, 201);
  }

  async buy(req: Request, res: Response): Promise<void> {
    const result = await marketplaceService.buy(req.user!, req.body.listingId);
    sendSuccess(res, result, 201);
  }

  async cancel(req: Request, res: Response): Promise<void> {
    const listing = await marketplaceService.cancel(req.user!, req.body.listingId);
    sendSuccess(res, listing);
  }
}

export const marketplaceController = new MarketplaceController();
