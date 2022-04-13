import express, { Router } from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import { BaseHttp } from '@/base-http';
import { NotFoundError } from '@/errors';
import { logger } from '@/logger';
import { Module, HttpServerConfig } from '@/types';

export class HttpServer extends BaseHttp implements Module {
  constructor(private readonly config: HttpServerConfig) {
    super(config);
  }

  start(): void {
    const app = express();
    const router = Router({ mergeParams: true });
    const builded_routes = this.buildRoutes(router);

    app.set('trust proxy', true);
    app.use(helmet());
    app.use(compression());
    app.use(
      bodyParser.json({
        limit: this.config.env.http_body_limit,
      })
    );

    router.get(
      ['/info', '/status'],
      async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        try {
          res.sendStatus(204);
        } catch (err) {
          next(err);
        }
      }
    );

    app.use(builded_routes);

    app.use(
      '*',
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        next(new NotFoundError('PAGE_NOT_FOUND', 'Page not found.'));
      }
    );

    const error_handler = this.errorHandler() as any;
    app.use(error_handler);

    app.listen(this.config.env.http_port, () =>
      logger.info(`Server running on port ${this.config.env.http_port}`)
    );
  }
}
