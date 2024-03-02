import {
  StackProps,
  NestedStackProps,
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_route53 as r53,
} from 'aws-cdk-lib';
import { AppMetadata } from '../config';
import { IQueue } from 'aws-cdk-lib/aws-sqs';

export interface ExtendedStackProps extends StackProps {
  deploymentTarget: string;
  awsRegion: string;
  appMetadata: AppMetadata;

  resourceSuffix: string;
  fqdn: string;
  orgNameAbbv: string;
  wildcardCert?: acm.ICertificate;
  existingWildcardCertArn?: string;
  vpc?: ec2.IVpc;
  existingVpcId?: string;
  vpcAvailabilityZones?: Array<string>;
  hostedZone?: r53.IHostedZone;
  existingHostedZoneId?: string;
  existingHostedZoneName?: string;
  createNewVpc?: boolean;
  createNewHostedZone?: boolean;
  existingVpcSubnets?: string;
  existingRouteTables?: string;
  existingDbSecurityGroupIds?: string;
  getFormattedResourceName: (name: string) => string;
  isProdDeployment?: boolean;
  additionalEnvironmentVariables?: Record<string, string>,
  broadcastMessageSqsQueue?: IQueue,
}

export interface ExtendedNestedStackProps extends NestedStackProps, ExtendedStackProps {}
