export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['API', 'CNS_WORKER', 'ZNS_WORKER', 'MIGRATIONS'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: +(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000
      ),
    },
  },
  TYPEORM: {
    LOGGING: {
      colorize: process.env.TYPEORM_LOGGING_COLORIZE || true,
    },
    type: 'postgres' as const,
    url:
      process.env.RESOLUTION_POSTGRES_URL ||
      'postgresql://postgres:secret@localhost/resolutionservice',
  },
};
