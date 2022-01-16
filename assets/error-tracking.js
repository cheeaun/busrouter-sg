import * as Sentry from '@sentry/react';
import { Integrations } from '@sentry/tracing';

Sentry.init({
  dsn: 'https://a642f8fa9ac2447386c7fbfbc7248353@o3070.ingest.sentry.io/6150802',
  integrations: [new Integrations.BrowserTracing()],
  tracesSampleRate: 1.0,
  environment:
    location.hostname === 'busrouter.sg' ? 'production' : 'development',
  debug: /localhost/i.test(location.hostname),
});
