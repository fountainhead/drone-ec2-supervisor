# drone-ec2-supervisor

Automatically Starts/Stops an EC2 Instance based on Drone CI queued Jobs.

## Overview

This program operates in conjunction with a [Drone CI](https://drone.io) installation to automatically start or stop a
dedicated Drone Worker that is running on an EC2 Instance based on the current status of queued jobs:

- When there are queued jobs, the EC2 Instance is started.
- When there are no queued jobs, the EC2 Instance is stopped.

## Design Goals & Motivations

Having a single, high-spec Worker instance is desirable for the following reasons:

- Able to run many pipeline stages concurrently across multiple projects.
- Able to run pipeline stages with many concurrent steps.
- Maximal Docker Layer Cache utilization without needing to implement:
  - Complicated cache sharing strategies.
  - Experimental shared-cache storage backends.
- A single, large EBS Volume yields better IO performance than several drives smaller volumes attached to multiple
  workers.

The drawback to this approach is of course the expense of operating a high-spec EC2 Instance that potentially spends the
majority of it's time sitting idle. By stopping the instance when it is not required, significant cost savings can be
made while retaining the benefits of using a high-spec instance.

By only being responsible for starting and stopping an existing EC2 Instance, you are free to configure your Drone
Worker to your exact specification by whichever means you please -- be it the AWS Console, CloudFormation, or other
provisioning tool.

## Prior Art & Inspiration

The concept of dynamically starting and stopping Worker instances was inspired by [Drone Autoscaler](https://github.com/drone/autoscaler). However, this project differs in that:

- A single instance is managed (as opposed to a fleet of instances.)
- This program is only capable of starting or stopping an existing instance (as opposed to dynamically launching and
  terminating instances.)

## Usage

The program is available as an [NPM Package](https://npmjs.com/package/@fountainhead/drone-ec2-supervisor). To install the tool globally:

```shell
$ npm install -g @fountainhead/drone-ec2-supervisor
$ npm-supervisor
```

Alternatively, you may use the `npx` tool to install and invoke the application in one step:

```shell
$ npx @fountainhead/drone-ec2-supervisor
```

This tool is also published as a [Docker Image](https://hub.docker.com/r/fountainheadtech/drone-ec2-supervisor) and may be run via `docker`:

```shell
$ docker run fountainheadtech/drone-ec2-supervisor
```

**NOTE**: In all cases, configuration parameters must be specified by Environment Variables for the program to operate. These Environment Variables are discussed in the next section.

## Environment Variables

This Program receives it's configuration parameters via Environment Variables, which are detailed below:

| Variable | Description | Default |
|----------|-------------|---------|
| `DRONE_TOKEN` | The API Token that should be used for communicating with the Drone Server. | **REQUIRED** |
| `DRONE_SERVER` | The URL of the Drone Server. | **REQUIRED** |
| `EC2_INSTANCE_ID` | The ID of the EC2 Instance to start/stop based on Drone queue activity. | **REQUIRED** |
| `EC2_HIBERNATION_ENABLED` | Whether stop the EC2 Instance using AWS's 'hibernate on stop' behaviour. Requires that the Instance be explicitly configured to support Hibernation. Set to `false` to use the normal 'stop' behaviour. | `true` |
| `CHECK_INTERVAL_SECONDS` | The interval between each check of the Drone queue state and EC2 Instance State, in seconds. | `15` |
| `STOP_TIMEOUT_SECONDS` | The number of seconds to wait before stopping the EC2 Instance when the Drone queue is empty. This allows the 'debounce' period to be tuned to your liking depending. <br/>**NOTE:** It is recommended that this value be at least double that of `CHECK_INTERVAL_SECONDS`, to ensure that the EC2 Instance doesn't get shut down before the next check of the Drone queue and EC2 Instance State. | `60` |
| `LOG_LEVEL` | The log level that should be emitted to stdout.<br/>Allowed values are `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG` and `TRACE`. | `INFO` |
| `PRETTY_LOGS` | When `true`, logs emitted to stdout are in a human-readable, 'pretty' format. When `false`, logs are emitted to stdout in a JSON format. | `true` |

Please observe that the program does not explicitly read any AWS credentials from the environment or other source.
Loading of AWS credentials is deferred to the `aws-sdk` library. Please supply valid AWS credentials via the means
supported by that library (such as via the `AWS_` environment variables, `~/.aws/credentials` file, EC2 Instance
Profile, etc.)

## Programmatic Usage

It is also possible to utilize drone-ec2-supervisor as part of another JavaScript/TypeScript application. Please refer to
[src/index.ts](https://github.com/FountainheadTechnologies/drone-ec2-supervisor/tree/master/src/index.ts) for an example of
how to create a Supervisor object that polls a Drone API and EC2 Instance state.

## Developing & Contributing

Pull Requests for bug fixes and reliability/stability improvements are greatly welcomed. However, support for providers
aside from AWS are not being considered at this time. You are of course welcome to fork this project and use it as a
base for a project that targets other providers.

- Install development dependencies using `yarn install`
- Run the application in development mode with `yarn dev`.<br/>
  (this will pre-configure `PRETTY_LOGS` to `true` and `LOG_LEVEL` to `trace`, but you will still need to specify
  `DRONE_TOKEN`, `DRONE_SERVER` and `EC2_INSTANCE_ID` yourself.)
- Run the unit test suite with `yarn test`
- Perform linting with `yarn lint`
