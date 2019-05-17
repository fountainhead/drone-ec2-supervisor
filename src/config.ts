export type Config = {
  checkIntervalSeconds: number;
  stopTimeoutSeconds: number;

  drone: {
    ignoreRunningForSeconds: number;
    token: string;
    server: string;
  },

  ec2: {
    instanceId: string;
    hibernationEnabled: boolean;
  }
};

export const createFromEnvironment = (): Config => {
  const droneToken = process.env.DRONE_TOKEN;
  if (!droneToken) {
    throw new Error('Please specify a Drone API token using the `DRONE_TOKEN` environment variable.');
  }

  const droneServer = process.env.DRONE_SERVER;
  if (!droneServer) {
    throw new Error('Please specify the Drone API server using the `DRONE_SERVER` environment variable.');
  }

  const ec2InstanceId = process.env.EC2_INSTANCE_ID;
  if (!ec2InstanceId) {
    throw new Error(
      'Please specify the ID of the EC2 Instance to supervise using the `EC2_INSTANCE_ID` environment variable',
    );
  }

  const ec2HibernationEnabled = process.env.EC2_HIBERNATION_ENABLED === 'true';

  const checkIntervalSeconds = process.env.CHECK_INTERVAL_SECONDS ?
    parseInt(process.env.CHECK_INTERVAL_SECONDS, 10) :
    15;

  const stopTimeoutSeconds = process.env.STOP_TIMEOUT_SECONDS ?
    parseInt(process.env.STOP_TIMEOUT_SECONDS, 10) :
    60;

  const ignoreRunningForSeconds = process.env.IGNORE_RUNNING_FOR_SECONDS ?
    parseInt(process.env.IGNORE_RUNNING_FOR_SECONDS, 10) :
    3600;

  return {
    checkIntervalSeconds,
    drone: {
      ignoreRunningForSeconds,
      server: droneServer,
      token: droneToken,
    },
    ec2: {
      hibernationEnabled: ec2HibernationEnabled,
      instanceId: ec2InstanceId,
    },
    stopTimeoutSeconds,
  };
};
