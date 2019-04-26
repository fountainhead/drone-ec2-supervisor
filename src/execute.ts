import { EC2 } from 'aws-sdk';
import { Logger } from 'pino';

import { Action } from './plan';

let scheduleTimer: NodeJS.Timeout | undefined;

type ScheduleOptions = {
  log: Logger;
  fn?: () => void;
  timeoutSeconds?: number;
};

const MAX_RETRY_TIMEOUT = 15;

export const schedule = (options: ScheduleOptions) => {
  const { log: parentLogger, fn, timeoutSeconds = 0 } = options;
  const log = parentLogger.child({ name: 'execute.schedule' });

  if (scheduleTimer) {
    log.info('Cancelling previously scheduled action');
    clearTimeout(scheduleTimer);
    scheduleTimer = undefined;
  }

  if (!fn) {
    return;
  }

  log.info('Will execute next action in %d seconds', timeoutSeconds);

  scheduleTimer = setTimeout(async () => {
    log.info('Executing scheduled action');
    scheduleTimer = undefined;

    try {
      const result = await fn();
      log.info({ result }, 'Execution of scheduled action successful');
    } catch (err) {
      log.warn({ err }, 'Execution of scheduled action threw an error');
      const retrySeconds =
        timeoutSeconds === 0 ?
          1 :
          Math.min(timeoutSeconds * 2, MAX_RETRY_TIMEOUT);

      log.info({ retrySeconds }, 'Retry scheduled in %d seconds', retrySeconds);

      schedule({ ...options, timeoutSeconds: retrySeconds });
    }
  }, timeoutSeconds * 1000);
};

type ExecuteOptions = {
  log: Logger;
  action: Action;
  stopTimeoutSeconds: number;
  ec2: {
    client: EC2
    instanceId: string;
    hibernationEnabled: boolean;
  }
};

export const execute = ({ log, action, ec2, stopTimeoutSeconds }: ExecuteOptions) => {
  if (action === Action.NoOp) {
    return schedule({ log });
  }

  if (action === Action.Start) {
    return schedule({
      fn: () => start({ ...ec2, log }),
      log,
    });
  }

  if (action === Action.ScheduleStop) {
    return schedule({
      fn: () => stop({ ...ec2, log }),
      log,
      timeoutSeconds: stopTimeoutSeconds,
    });
  }
};

type StartOptions = {
  log: Logger;
  client: EC2;
  instanceId: string;
};

export const start = async ({ log: parentLogger, client, instanceId }: StartOptions) => {
  const log = parentLogger.child({ name: 'execute.start', instanceId });

  log.info({ phase: 'start' }, `Starting EC2 Instance '%s'`, instanceId);

  const result = await client.startInstances({
    InstanceIds: [instanceId],
  }).promise();

  log.info({ phase: 'finish' }, `Started EC2 Instance '%s'`, instanceId);
  log.trace({ result });
};

type StopOptions = {
  log: Logger;
  client: EC2;
  instanceId: string;
  hibernationEnabled: boolean;
};

export const stop = async ({ log: parentLogger, client, instanceId, hibernationEnabled }: StopOptions) => {
  const log = parentLogger.child({ name: 'execute.stop', instanceId, hibernationEnabled });

  log.info({ phase: 'start' }, `Stopping EC2 Instance '%s'`, instanceId);

  const result = await client.stopInstances({
    Hibernate: hibernationEnabled,
    InstanceIds: [instanceId],
  }).promise();

  log.info({ phase: 'finish' }, `Stopped EC2 Instance '%s'`, instanceId);
  log.trace({ result });
};
