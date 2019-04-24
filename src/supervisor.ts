import { EC2 } from 'aws-sdk';
import chalk from 'chalk';
import nodeFetch from 'node-fetch';
import { Logger } from 'pino';

import { Config } from './config';
import { execute } from './execute';
import { Action, plan } from './plan';

export type CreateOptions = {
  log: Logger;
  config: Config;
  deps: {
    fetchFn: typeof nodeFetch;
    ec2client: EC2;
  }
};

export const create = ({ log: parentLog, config, deps }: CreateOptions) => {
  const log = parentLog.child({ name: 'supervisor' });

  let currentAction = Action.NoOp;

  const check = async () => {
    log.debug('Performing check');

    const nextAction = await plan({
      drone: {
        ...config.drone,
        fetchFn: deps.fetchFn,
      },
      ec2: {
        ...config.ec2,
        client: deps.ec2client,
      },
      log,
    });

    log.debug({ nextAction }, 'Next action is: %s', nextAction);

    if (nextAction !== currentAction) {
      log.info(
        { currentAction, nextAction },
        `Planned Action has changed from %s to %s`,
        chalk.red(currentAction), chalk.green(nextAction),
      );

      execute({
        action: nextAction,
        ec2: {
          ...config.ec2,
          client: deps.ec2client,
        },
        log,
        stopTimeoutSeconds: config.stopTimeoutSeconds,
      });
    }

    currentAction = nextAction;
  };

  log.info({ phase: 'start' }, 'Creating Supervisor (checking every %d seconds)', config.checkIntervalSeconds);

  const interval = setInterval(check, config.checkIntervalSeconds * 1000);

  return () => {
    log.info({ phase: 'finish' }, 'Terminating Supervisor');
    clearInterval(interval);
  };
};
