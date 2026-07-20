import type { Request, Response, NextFunction } from 'express';

/**
 * Phase 9: advertise API version and deprecation posture without breaking v1 clients.
 */
export class ApiVersionMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-API-Version', 'v1');
    res.setHeader('X-API-Deprecation', 'false');
    res.setHeader('X-API-Supported-Versions', 'v1');
    void req;
    next();
  }
}
