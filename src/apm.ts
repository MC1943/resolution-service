import type { TracerOptions } from 'dd-trace';
import tracer from 'dd-trace';
import { env } from './env';

if (env.APPLICATION.DATADOG_APM_ENABLE === 'true') {
  const options: TracerOptions = {
    //enabled: true,
    logLevel: 'debug',
    logInjection: true,
    profiling: true,
    reportHostname: true,
    runtimeMetrics: false, // requires UDP on port 8125
    startupLogs: true,
    hostname: env.APPLICATION.DATADOG_AGENT_HOSTNAME,
    service: env.APPLICATION.DATADOG_APM_SERVICE_NAME,
    version: process.env.GAE_VERSION,
  };

  tracer.init(options);
}
