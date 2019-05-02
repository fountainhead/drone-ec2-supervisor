import { EC2 } from 'aws-sdk';
import nodeFetch from 'node-fetch';
import { Logger } from 'pino';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

type GetDroneQueueOptions = {
  log: Logger;
  token: string;
  server: string;
  fetchFn: typeof nodeFetch;
};

// Drone's Queue API items contain more fields than this, but all we care about for our purposes is `status`
export type DroneQueueItem = {
  status: 'running' | 'pending';
};

export const getDroneQueue =
  async ({ token, server, log: parentLog, fetchFn }: GetDroneQueueOptions): Promise<DroneQueueItem[]> => {
    const log = parentLog.child({ name: 'plan.getDroneQueue' });

    log.debug({ phase: 'start', server });

    const queue = await fetchFn(`${server}/api/queue`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).then(r => r.json());

    log.debug({ phase: 'finish', queueLength: queue.length });
    log.trace({ queue });

    return queue;
  };

type DetermineDroneQueueStateOptions = {
  log: Logger;
  queue: DroneQueueItem[];
};

export enum DroneQueueState {
  Empty = 'empty',
  Running = 'running',
  Pending = 'pending',
}

export const determineDroneQueueState =
  ({ log: parentLog, queue }: DetermineDroneQueueStateOptions): DroneQueueState => {
    const log = parentLog.child({ name: 'plan.determineDroneQueueState' });

    if (queue.length === 0) {
      log.debug({ phase: 'finish', determinedState: 'empty' });
      return DroneQueueState.Empty;
    }

    if (queue.find(({ status }) => status === 'running')) {
      log.debug({ phase: 'finish', determinedState: 'running' });
      return DroneQueueState.Running;
    }

    const pending = queue.filter(({ status }) => status === 'pending');
    if (pending.length === queue.length) {
      log.debug({ phase: 'finish', determinedState: 'pending' });
      return DroneQueueState.Pending;
    }

    throw new Error('Unable to determine Drone Queue State');
  };

type GetEc2InstanceOptions = {
  log: Logger;
  client: EC2;
  instanceId: string;
};

export const getEc2Instance = async ({ client, instanceId, log: parentLog }: GetEc2InstanceOptions) => {
  const log = parentLog.child({ name: 'plan.getEc2Instance' });

  log.debug({ phase: 'start', instanceId });

  const result = await client.describeInstances({
    InstanceIds: [instanceId],
  }).promise();

  log.trace({ result });

  const instance = result.Reservations![0].Instances![0];

  if (instance.State && instance.State.Name === 'terminated') {
    throw new Error(
      `The EC2 Instance '${instanceId}' has been terminated. ` +
      `Please specify the ID of an Instance that is not in the 'terminated' state.`,
    );
  }

  log.debug({ phase: 'finish' });
  log.trace({ instance });

  return instance;
};

type DetermineEc2InstanceStateOptions = {
  log: Logger;
  instance: EC2.Instance
};

export enum Ec2InstanceState {
  Pending = 'pending',
  Running = 'running',
  ShuttingDown = 'shutting-down',
  Terminated = 'terminated',
  Stopping = 'stopping',
  Stopped = 'stopped',
}

export const determineEc2InstanceState =
  ({ log: parentLog, instance }: DetermineEc2InstanceStateOptions): Ec2InstanceState => {
    const log = parentLog.child({ name: 'plan.determineEc2InstanceState' });

    if (!instance.State || !instance.State.Name) {
      throw new Error('Unable to determine EC2 Instance State');
    }

    log.debug({ phase: 'finish', determinedState: instance.State.Name });
    return instance.State.Name as Ec2InstanceState;
  };

export enum Action {
  NoOp = 'noop',
  Start = 'start',
  ScheduleStop = 'schedule-stop',
}

type DetermineNextActionOptions = {
  log: Logger;
  droneQueueState: DroneQueueState;
  ec2InstanceState: Ec2InstanceState;
};

export const determineNextAction =
  ({ log: parentLog, droneQueueState, ec2InstanceState }: DetermineNextActionOptions): Action => {
    const log = parentLog.child({ name: 'plan.determineNextAction' });

    if (droneQueueState === DroneQueueState.Empty) {
      if (ec2InstanceState === Ec2InstanceState.Pending || ec2InstanceState === Ec2InstanceState.Running) {
        const nextAction = Action.ScheduleStop;
        log.debug({ phase: 'finish', nextAction });
        return nextAction;
      }
    }

    if (droneQueueState === DroneQueueState.Pending || droneQueueState === DroneQueueState.Running) {
      if (ec2InstanceState === Ec2InstanceState.Stopping || ec2InstanceState === Ec2InstanceState.Stopped) {
        const nextAction = Action.Start;
        log.debug({ phase: 'finish', nextAction });
        return nextAction;
      }
    }

    const nextAction = Action.NoOp;
    log.debug({ phase: 'finish', nextAction });
    return nextAction;
  };

type PlanOptions = {
  log: Logger;
  drone: Omit<GetDroneQueueOptions, 'log'>;
  ec2: Omit<GetEc2InstanceOptions, 'log'>;
};

export const plan = async ({ log, drone, ec2 }: PlanOptions) => {
  const [queue, instance] = await Promise.all([
    getDroneQueue({ ...drone, log }),
    getEc2Instance({ ...ec2, log }),
  ]);

  const droneQueueState = determineDroneQueueState({ log, queue });
  const ec2InstanceState = determineEc2InstanceState({ log, instance });

  return determineNextAction({ log, droneQueueState, ec2InstanceState });
};
