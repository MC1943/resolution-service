import * as path from 'path';
import znsConfig from './znsEnv';

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || process.env.PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['API', 'CNS_WORKER', 'ZNS_WORKER', 'MIGRATIONS'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: +(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000
      ),
    },
    ZILLIQA: {
      ...znsConfig,
      VIEWBLOCK_API_KEY: process.env.VIEWBLOCK_API_KEY,
      VIEWBLOCK_API_URL: 'https://api.viewblock.io/v1/zilliqa',
    },
    NEW_RELIC_LICENSE_KEY: process.env.NEW_RELIC_LICENSE_KEY || '',
    NEW_RELIC_APP_NAME: process.env.NEW_RELIC_APP_NAME || '',
    BUGSNAG_API_KEY: process.env.BUGSNAG_API_KEY || '',
  },
  TYPEORM: {
    LOGGING: {
      colorize: process.env.TYPEORM_LOGGING_COLORIZE || true,
    },
    type: 'postgres' as const,
    host: process.env.RESOLUTION_POSTGRES_HOST || 'localhost',
    username: process.env.RESOLUTION_POSTGRES_USERNAME || 'postgres',
    password: process.env.RESOLUTION_POSTGRES_PASSWORD || 'secret',
    database:
      process.env.RESOLUTION_POSTGRES_DATABASE ||
      (process.env.NODE_ENV === 'test'
        ? 'resolution_service_test'
        : 'resolution_service'),

    entities: [
      path.join(__dirname, './models/index.ts'),
      path.join(__dirname, './models/index.js'),
    ] as string[],
    migrations: [
      path.join(__dirname, './database/migrations/*.ts'),
      path.join(__dirname, './database/migrations/*.js'),
    ] as string[],
  },
};
