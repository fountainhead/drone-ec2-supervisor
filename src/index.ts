import { EC2 } from 'aws-sdk';
import fetch from 'node-fetch';

import { createFromEnvironment as createConfig } from './config';
import { createFromEnvironment as createLogger } from './logger';
import { create as createSupervisor } from './supervisor';

const log = createLogger();
const config = createConfig();

log.info({ phase: 'start' }, 'Initialization complete');

createSupervisor({
  config,
  deps: {
    ec2client: new EC2(),
    fetchFn: fetch,
  },
  log,
});
