import {
  Stack,
  StackProps,
  aws_codeartifact as codeartifact,
  aws_ssm as ssm,
  aws_route53 as r53,
  aws_rds as rds,
  aws_s3 as s3,
  aws_ec2 as ec2,
  aws_certificatemanager as acm,
  aws_logs as logs,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Construct } from 'constructs';
import { AppMetadata } from '../config';
import { CognitoAuthStack } from './cognito-auth.stack';
import { AppWebUIStack } from './app-web-ui.stack';
import { ExtendedNestedStackProps, ExtendedStackProps } from './stack-interfaces';
import { ApiStack } from './api.stack';
import { RdsPostgresqlStack } from './rds-postgres.stack';
import { RedisElasticacheStack } from './redis-elasticache.stack';
import { InterfaceVpcEndpointAwsService, IpAddresses } from 'aws-cdk-lib/aws-ec2';
import { WebOpenApiStack } from './web-openapi.stack';
import { AccountResourcesStack } from './account-resources.stack';
import { WebsocketApiStack } from './websocket-api.stack';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    // Setup
    const { deploymentTarget, awsRegion, appMetadata, getFormattedResourceName } = props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const rootDomain = 'newamerica.org';
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;
    const isProdDeployment = deploymentTarget === 'prod';
    const fqdn = isProdDeployment ? rootDomain : `${deploymentTarget.toLowerCase()}.${rootDomain}`;
    const { EXISTING_HOSTED_ZONE_ID = '', EXISTING_HOSTED_ZONE_NAME = '', NA_WILDCARD_CERT_ARN = '', VPC_ID = '' } = process.env;

    // Account Resources
    const accountResourcesStack = new AccountResourcesStack(this, 'AccountResourcesStack', {
      ...props,
      orgNameAbbv,
      fqdn,
      resourceSuffix,
      isProdDeployment,
      existingVpcId: VPC_ID,
    });
    const { vpc, hostedZone, wildcardCert } = accountResourcesStack;

    // Code Artifact
    if (!isProdDeployment) {
      const codeArtifactDomain = new codeartifact.CfnDomain(this, getFormattedResourceName('code-artifact-domain'), {
        domainName: `${orgNameAbbv}-npm`,
      });

      const npmRepository = new codeartifact.CfnRepository(this, getFormattedResourceName('code-artifact-repo'), {
        domainName: codeArtifactDomain.domainName,
        repositoryName: `${orgNameAbbv}-npm`,
        externalConnections: ['public:npmjs'],
      });
      npmRepository.addDependency(codeArtifactDomain);
    }

    // // Database Stack
    const dbStack = new RdsPostgresqlStack(this, 'RdsPostgresqlStack', {
      ...props,
      wildcardCert,
      hostedZone,
      vpc,
      isProdDeployment,
    });

    // // Redis Elasticache Cluster
    const redisElasticacheClusterStack = new RedisElasticacheStack(this, 'RedisElasticacheStack', {
      ...props,
      wildcardCert,
      hostedZone,
      vpc,
    });

    // // // API Stack
    const apiStack = new ApiStack(this, 'ApiStack', {
      ...props,
      wildcardCert,
      hostedZone,
      vpc,
      isProdDeployment,
      fqdn,
    });

    // // // Cognito Auth Stack
    const authStack = new CognitoAuthStack(this, 'CognitoAuthStack', {
      ...props,
      wildcardCert,
      hostedZone,
      fqdn,
    });

    // // Web UI Stack
    const appWebUiStack = new AppWebUIStack(this, 'AppWebUIStack', {
      ...props,
      wildcardCert,
      hostedZone,
      fqdn,
    });

    // // OpenAPI - Web UI Stack
    const openApiWebUiStack = new WebOpenApiStack(this, 'WebOpenApiStack', {
      ...props,
      wildcardCert,
      hostedZone,
    });

    // Websocket API Stack
    const websocketApiStack = new WebsocketApiStack(this, 'WebsocketApiStack', {
      ...props,
      wildcardCert,
      hostedZone,
      fqdn,
    });

    // // SSM Parameters
    new ssm.StringParameter(this, `ssm-vpc-main-arn${resourceSuffix}`, {
      stringValue: vpc.vpcArn,
      parameterName: `vpc-main-arn${resourceSuffix}`,
    });
    new ssm.StringParameter(this, `ssm-vpc-main-id${resourceSuffix}`, {
      stringValue: vpc.vpcId,
      parameterName: `vpc-main-id${resourceSuffix}`,
    });
  }
}
