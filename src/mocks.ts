import { EC2 } from 'aws-sdk';
import { Logger } from 'pino';

export const log = {
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
} as any as Logger;

export const fetchResponse: any = {
  json: jest.fn().mockImplementation(() => fetchResponse.value),
  value: undefined,
};

export const fetchFn = jest.fn().mockResolvedValue(fetchResponse) as any;

export const describeInstancesResponse: any = {
  value: undefined,
};

export const ec2client = {
  describeInstances: jest.fn().mockReturnValue({
    promise: jest.fn().mockImplementation(() => Promise.resolve(describeInstancesResponse.value)),
  }),

  startInstances: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue(true),
  }),

  stopInstances: jest.fn().mockReturnValue({
    promise: jest.fn().mockReturnValue(true),
  }),
} as any as EC2;
