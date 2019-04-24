import * as execute from './execute';
import { ec2client, log } from './mocks';
import { Action } from './plan';

describe('start', () => {
  it('starts the EC2 Instance', async () => {
    await execute.start({
      client: ec2client,
      instanceId: 'test-instance',
      log,
    });

    expect(ec2client.startInstances).toHaveBeenCalledWith({
      InstanceIds: ['test-instance'],
    });
  });
});

describe('stop', () => {
  it('stops the EC2 Instance', async () => {
    await execute.stop({
      client: ec2client,
      hibernationEnabled: true,
      instanceId: 'test-instance',
      log,
    });

    expect(ec2client.stopInstances).toHaveBeenCalledWith({
      Hibernate: true,
      InstanceIds: ['test-instance'],
    });
  });
});

describe('schedule', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('executes the given function after the next tick', () => {
    const fn = jest.fn();
    execute.schedule({ log, fn });

    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalled();
  });

  it('executes the given function after a given number of seconds', () => {
    const fn = jest.fn();
    execute.schedule({ log, fn, timeoutSeconds: 10 });

    jest.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalled();
  });

  it('cancels any pending invocations on subsequent calls', () => {
    const fn1 = jest.fn();
    execute.schedule({ log, fn: fn1, timeoutSeconds: 10 });

    const fn2 = jest.fn();
    execute.schedule({ log, fn: fn2 });

    jest.advanceTimersByTime(10000);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();

    execute.schedule({ log, fn: fn1, timeoutSeconds: 10 });
    execute.schedule({ log });
    jest.advanceTimersByTime(10000);
    expect(fn1).not.toHaveBeenCalled();
  });

  it('it logs exceptions as a warning', () => {
    const err = new Error('oh no!');

    const fn = jest.fn().mockImplementation(() => {
      throw err;
    });

    execute.schedule({ log, fn, timeoutSeconds: 10 });
    jest.advanceTimersByTime(10000);

    expect(log.warn).toHaveBeenCalledWith({ err }, 'Execution of scheduled action threw an error');
  });
});

describe('execute', () => {
  let start: jest.SpyInstance;
  let stop: jest.SpyInstance;

  beforeEach(() => {
    start = jest.spyOn(execute, 'start').mockResolvedValue();
    stop = jest.spyOn(execute, 'stop').mockResolvedValue();
    jest.useFakeTimers();
  });

  afterEach(() => {
    start.mockRestore();
    stop.mockRestore();
    jest.useRealTimers();
  });

  describe('when `action` is `noop`', () => {
    it('does not run `start` or `stop`', () => {
      execute.execute({
        action: Action.NoOp,
        ec2: {} as any,
        log,
        stopTimeoutSeconds: 0,
      });

      jest.runAllTimers();

      expect(start).not.toHaveBeenCalled();
      expect(stop).not.toHaveBeenCalled();
    });
  });

  describe('when `action` is `start`', () => {
    it('calls `start` immediately', () => {
      execute.execute({
        action: Action.Start,
        ec2: {} as any,
        log,
        stopTimeoutSeconds: 0,
      });

      jest.runAllTimers();

      expect(start).toHaveBeenCalled();
      expect(stop).not.toHaveBeenCalled();
    });
  });

  describe('when `action` is `schedule-stop`', () => {
    it('calls `stop` after given time has elapsed', () => {
      execute.execute({
        action: Action.ScheduleStop,
        ec2: {} as any,
        log,
        stopTimeoutSeconds: 10,
      });

      jest.runAllTimers();

      expect(start).not.toHaveBeenCalled();
      expect(stop).toHaveBeenCalled();
    });
  });
});
