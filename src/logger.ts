import { init } from '@somosphi/logger';
import bformat from 'bunyan-format';
import * as dotenv from 'dotenv';

dotenv.config();

const format_out = bformat({
  outputMode: process.env.LOGGER_BEAUTIFY ? 'short' : 'bunyan',
});

/* eslint-disable */
const { Logger, ExpressLogger, AxiosLogger } = init({
  PROJECT_NAME: 'clean-arquitecture-boilerplate',
  // @ts-ignore
  LOG_LEVEL: process.env.LOGGER_LEVEL || 'info',
  STREAMS: [
    {
      stream: format_out,
    },
  ],
});

export const logger = Logger;
export const expressLogger = ExpressLogger;
export const axiosLogger = AxiosLogger;
