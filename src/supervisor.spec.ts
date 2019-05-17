import * as _execute from './execute';
import { ec2client, fetchFn, log } from './mocks';
import * as _plan from './plan';
import * as supervisor from './supervisor';

describe('create', () => {
  let plan: jest.SpyInstance;
  let execute: jest.SpyInstance;

  const options: supervisor.CreateOptions = {
    config: {
      checkIntervalSeconds: 10,
      drone: {
        ignoreRunningForSeconds: 3600,
        server: 'http://test-server',
        token: 'test-token',
      },
      ec2: {
        hibernationEnabled: true,
        instanceId: 'test-instance',
      },
      stopTimeoutSeconds: 20,
    },
    deps: {
      ec2client,
      fetchFn,
    },
    log,
  };

  beforeEach(() => {
    plan = jest.spyOn(_plan, 'plan').mockResolvedValue(_plan.Action.NoOp);
    execute = jest.spyOn(_execute, 'execute').mockReturnValue();
    jest.useFakeTimers();
  });

  afterEach(() => {
    plan.mockRestore();
    execute.mockRestore();
    jest.useRealTimers();
  });

  it('calls `plan()` on every interval until `destroy` is called', () => {
    const destroy = supervisor.create(options);

    jest.advanceTimersByTime(30 * 1000);

    expect(plan).toHaveBeenCalledTimes(3);

    destroy();

    jest.advanceTimersByTime(30 * 1000);
    expect(plan).toHaveBeenCalledTimes(3);
  });

  it('only calls `execute` when next action changes', done => {
    const destroy = supervisor.create(options);

    jest.advanceTimersByTime(60 * 1000);
    expect(execute).toHaveBeenCalledTimes(0);

    expect(execute).toHaveBeenCalledTimes(0);

    plan.mockResolvedValue(_plan.Action.Start);
    jest.advanceTimersByTime(60 * 1000);

    // @HACK: For some reason, we have to wait until next tick for this assertion to pass
    setImmediate(() => {
      expect(execute).toHaveBeenCalledTimes(1);
      destroy();
      done();
    });
  });
});
