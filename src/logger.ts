import pino from 'pino';

export const createFromEnvironment = (): pino.Logger => {
  const prettyLogs = process.env.PRETTY_LOGS === 'true';
  const logLevel = process.env.LOG_LEVEL || 'info';

  const options: pino.LoggerOptions = {
    level: logLevel,
    name: 'main',
  };

  if (prettyLogs) {
    Object.assign(options, {
      prettyPrint: {
        ignore: 'pid, hostname',
        translateTime: true,
      },
    });
  }

  const log = pino(options);

  process.on('uncaughtException', err => {
    log.error(err, err.message);
    process.exit(1);
  });

  process.on('unhandledRejection' as any, (err: Error) => {
    log.error(err, err.message);
    process.exit(1);
  });

  process.on('exit', () => {
    const { exitCode } = process;
    log.info({ phase: 'finish', result: exitCode }, 'Exiting program with exit code %d', exitCode);
  });

  return log;
};
