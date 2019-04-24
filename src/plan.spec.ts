import { describeInstancesResponse, ec2client, fetchFn, fetchResponse, log } from './mocks';
import * as plan from './plan';

describe('getDroneQueue', () => {
  it('fetches the `/queue` endpoint from the Drone API using the specified token', async () => {
    const queue = [{ status: 'pending' }];
    fetchResponse.value = queue;

    const result = await plan.getDroneQueue({
      fetchFn,
      log,
      server: 'http://test-server',
      token: 'test-token',
    });

    expect(fetchFn).toHaveBeenCalledWith('http://test-server/api/queue', {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(result).toEqual(queue);
  });
});

describe('determineDroneQueueState', () => {
  type Test = {
    condition: string;
    queue: plan.DroneQueueItem[];
    state: plan.DroneQueueState;
  };

  const tests: Test[] = [{
    condition: 'is empty',
    queue: [],
    state: plan.DroneQueueState.Empty,
  }, {
    condition: `only contains 'running' items`,
    queue: [{ status: 'running' }, { status: 'running' }],
    state: plan.DroneQueueState.Running,
  }, {
    condition: `only contains 'pending' items`,
    queue: [{ status: 'pending' }, { status: 'pending' }],
    state: plan.DroneQueueState.Pending,
  }, {
    condition: `contains a mixture of 'running' and 'pending' items`,
    queue: [{ status: 'running' }, { status: 'pending' }, { status: 'running' }],
    state: plan.DroneQueueState.Running,
  }];

  tests.forEach(({ condition, queue, state }) => {
    describe(`when the queue ${condition}`, () => {
      it(`determines the state to be '${state}'`, () => {
        expect(plan.determineDroneQueueState({ log, queue })).toEqual(state);
      });
    });
  });
});

describe('getEc2Instance', () => {
  it('retrieves an EC2 Instance by Instance ID', async () => {
    const instance = {
      State: {
        Name: 'running',
      },
    };

    describeInstancesResponse.value = {
      Reservations: [{
        Instances: [instance],
      }],
    };

    const result = await plan.getEc2Instance({
      client: ec2client,
      instanceId: 'test-instance',
      log,
    });

    expect(ec2client.describeInstances).toHaveBeenCalledWith({
      InstanceIds: ['test-instance'],
    });

    expect(result).toBe(instance);
  });

  describe('when instance has been terminated', () => {
    it('throws an error', async () => {
      const instance = {
        State: {
          Name: 'terminated',
        },
      };

      describeInstancesResponse.value = {
        Reservations: [{
          Instances: [instance],
        }],
      };

      await expect(plan.getEc2Instance({
        client: ec2client,
        instanceId: 'test-instance',
        log,
      })).rejects.toThrowError(
        `The EC2 Instance 'test-instance' has been terminated. ` +
        `Please specify the ID of an Instance that is not in the 'terminated' state.`,
      );
    });
  });
});

describe('determineEc2InstanceState', () => {
  it('returns the instance state of an EC2 Instance', () => {
    expect(plan.determineEc2InstanceState({
      instance: {
        State: {
          Name: 'running',
        },
      },
      log,
    })).toEqual('running');
  });

  describe('when the `State` property is missing', () => {
    it('throws an error', () => {
      expect(() => plan.determineEc2InstanceState({
        instance: {},
        log,
      })).toThrowError('Unable to determine EC2 Instance State');
    });
  });

  describe('when the `State.Name` property is missing', () => {
    it('throws an error', () => {
      expect(() => plan.determineEc2InstanceState({
        instance: {
          State: {},
        },
        log,
      })).toThrowError('Unable to determine EC2 Instance State');
    });
  });
});

describe('determineNextAction', () => {
  type Test = {
    drone: plan.DroneQueueState;
    ec2: plan.Ec2InstanceState;
    action: plan.Action;
  };

  const tests: Test[] = [{
    action: plan.Action.NoOp,
    drone: plan.DroneQueueState.Empty,
    ec2: plan.Ec2InstanceState.Stopped,
  }, {
    action: plan.Action.NoOp,
    drone: plan.DroneQueueState.Running,
    ec2: plan.Ec2InstanceState.Running,
  }, {
    action: plan.Action.Start,
    drone: plan.DroneQueueState.Pending,
    ec2: plan.Ec2InstanceState.Stopped,
  }, {
    action: plan.Action.ScheduleStop,
    drone: plan.DroneQueueState.Empty,
    ec2: plan.Ec2InstanceState.Running,
  }];

  tests.forEach(({ drone, ec2, action }) => {
    describe(`when the Drone queue is in state '${drone}' and EC2 Instance is in state '${ec2}'`, () => {
      it(`determines next action to be '${action}'`, () => {
        expect(plan.determineNextAction({
          droneQueueState: drone,
          ec2InstanceState: ec2,
          log,
        })).toEqual(action);
      });
    });
  });
});

describe('plan', () => {
  type Test = {
    name: string;
    queue: plan.DroneQueueItem[];
    instanceState: string;
    action: plan.Action;
  };

  const tests: Test[] = [{
    action: plan.Action.NoOp,
    instanceState: 'stopped',
    name: 'no builds are pending and EC2 instance is stopped',
    queue: [],
  }, {
    action: plan.Action.NoOp,
    instanceState: 'running',
    name: 'builds are running and EC2 instance is running',
    queue: [{ status: 'running' }],
  }, {
    action: plan.Action.Start,
    instanceState: 'stopped',
    name: 'builds are pending and EC2 instance is stopped',
    queue: [{ status: 'pending' }],
  }, {
    action: plan.Action.ScheduleStop,
    instanceState: 'running',
    name: 'no builds are pending and EC2 instance is running',
    queue: [],
  }];

  tests.forEach(({ name, queue, instanceState, action }) => {
    describe(`when ${name}`, () => {
      it(`determines the next action to be '${action}'`, async () => {
        fetchResponse.value = queue;

        describeInstancesResponse.value = {
          Reservations: [{
            Instances: [{
              State: {
                Name: instanceState,
              },
            }],
          }],
        };

        const result = await plan.plan({
          drone: {
            fetchFn,
            server: 'http://test-server',
            token: 'test-token',
          },
          ec2: {
            client: ec2client,
            instanceId: 'test-instance',
          },
          log,
        });

        expect(result).toEqual(action);
      });
    });
  });
});
