import { DependencyContainer, InjectionToken } from 'tsyringe';
import Joi from 'joi';
import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import {
  HttpResponse,
  HttpRequest,
  RouteConfig,
  Middleware,
  Controller,
  HttpServerConfig,
} from '@/types';
import { HttpError, BadRequest } from '@/errors';
import { logger } from '@/logger';

export abstract class BaseHttp {
  protected controllers: Function[];

  protected container: DependencyContainer;

  constructor(config: HttpServerConfig) {
    this.container = config.container;
    this.controllers = config.controllers;
  }

  protected buildRoutes(router: Router): Router {
    this.controllers.forEach((controller: Function) => {
      const instance = this.container.resolve(controller as InjectionToken);

      if (!instance.route_configs) {
        return;
      }

      instance.route_configs.forEach((config: RouteConfig) => {
        const { path, middlewares, method, status_code, schema, has_schema } =
          config;

        if (has_schema && !schema) {
          throw new Error(`Schema to ${controller.name} is mandatory.`);
        }

        const request_validator = this.requestValidator(schema);
        const func = this.requestHandle(instance, status_code);

        const func_middleware: RequestHandler[] =
          this.buildMiddlewares(middlewares);

        const jobs = schema
          ? ([...func_middleware, request_validator, func] as any)
          : ([...func_middleware, func] as any);

        switch (method) {
          case 'get':
            router.get(path, jobs);
            break;
          case 'post':
            router.post(path, jobs);
            break;
          case 'put':
            router.put(path, jobs);
            break;
          case 'patch':
            router.patch(path, jobs);
            break;
          case 'delete':
            router.delete(path, jobs);
            break;
          default:
            break;
        }
      });
    });

    return router;
  }

  private requestHandle(
    instance: Controller,
    status_code?: number
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const response = (await instance.handle(req)) as HttpResponse;
        if (response?.headers) {
          for (const header in response.headers) {
            res.setHeader(header, response.headers[header]);
          }
        }
        const http_status = status_code || response.status;
        if (http_status) {
          res.status(http_status);
        }

        res.send(response?.data);
      } catch (err) {
        const error = instance.exception(err);
        next(error);
      }
    };
  }

  private buildMiddlewares(middlewares: Function[]): RequestHandler[] {
    return middlewares.map(middleware => {
      const instance_middleware = this.container.resolve(
        middleware as InjectionToken
      ) as Middleware;

      return async (req: Request, res: Response, next: NextFunction) => {
        try {
          await instance_middleware.handle(req);
          next();
        } catch (err) {
          logger.error(err);
          next(err);
        }
      };
    });
  }

  private requestValidator(schema?: Joi.Schema): RequestHandler | void {
    if (!schema) return undefined;
    return (req: Request, res: Response, next: NextFunction) => {
      const validation = schema.validate(req, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: true,
      });

      if (validation.error) {
        logger.debug(req?.body);
        logger.debug(req?.params);
        logger.debug(req?.query);
        return next(
          new BadRequest(
            'VALIDATION_FAILED',
            'Invalid request data',
            validation.error.details
          )
        );
      }

      Object.assign(req, validation.value);

      return next();
    };
  }

  protected errorHandler(): Function {
    return (
      error: any,
      req: HttpRequest,
      res: Response,
      next: NextFunction
    ) => {
      if (error instanceof HttpError) {
        const { status_code, message, code, details } = error;
        res.status(status_code || 200).send({
          code,
          message,
          details,
        });
      }

      if (error?.code === 'ER_DUP_ENTRY') {
        res.status(409).send({
          code: 'DUPLICATED_RESOURCE',
          message: 'Duplicated resource',
        });
      }

      res
        .status(500)
        .send({ code: 'UNEXPECTED_ERROR', message: 'Internal server failure' });

      return next();
    };
  }
}
