import express, { Router } from 'express';
import { Module, HttpServerConfig } from '@dabjs/common';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import compression from 'compression';
import { BaseHttp } from './base-http';
import { NotFoundError } from './errors';
import { logger } from './logger';

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
        limit: this.config.bodyLimit,
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

    app.listen(this.config.port, () =>
      logger.info(`Server running on port ${this.config.port}`)
    );
  }
}
