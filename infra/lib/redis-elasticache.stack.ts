import {
  Stack,
  StackProps,
  aws_ssm as ssm,
  aws_route53 as r53,
  aws_ec2 as ec2,
  aws_elasticache as elasticache,
  NestedStack,
  NestedStackProps,
} from 'aws-cdk-lib';
import { KeyPair } from 'cdk-ec2-key-pair';
import { Construct } from 'constructs';
import { AppMetadata } from '../config';
import { Mfa } from 'aws-cdk-lib/aws-cognito';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ExtendedNestedStackProps } from './stack-interfaces';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class RedisElasticacheStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    // Setup
    const { deploymentTarget, awsRegion, appMetadata, getFormattedResourceName, vpc } = props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const fqdn = 'newamerica.org';
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;

    // Redis Elasticache Cluster
    const clusterSecurityGroup = new ec2.SecurityGroup(this, getFormattedResourceName('redis-elasticache-sg'), {
      vpc: vpc!,
      securityGroupName: getFormattedResourceName('redis-elasticache-sg'),
    });
    clusterSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(6379),
      'Redis Elasticache Security Group: Any private ip address ingress.',
    );
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      getFormattedResourceName('redis-elasticache-subnet-group'),
      {
        description: 'Core VPC Subnets',
        subnetIds: [...vpc!.privateSubnets.map(s => s.subnetId)],
        cacheSubnetGroupName: getFormattedResourceName('redis-elasticache-subnet-group'),
      },
    );
    const redisElasticacheCluster = new elasticache.CfnCacheCluster(
      this,
      getFormattedResourceName('redis-elasticache-cluster'),
      {
        cacheNodeType: 'cache.t3.micro',
        engine: 'redis',
        numCacheNodes: 1,
        clusterName: getFormattedResourceName('redis-elasticache-cluster'),
        vpcSecurityGroupIds: [clusterSecurityGroup.securityGroupId],
        cacheSubnetGroupName: cacheSubnetGroup.cacheSubnetGroupName,
      },
    );

    // SSM Parameters
    new ssm.StringParameter(this, getFormattedResourceName('ssm-redis-elasticache-host-and-port'), {
      stringValue: `${redisElasticacheCluster.attrRedisEndpointAddress}:${redisElasticacheCluster.attrRedisEndpointPort}`,
      parameterName: getFormattedResourceName('redis-elasticache-host-and-port'),
    });
  }
}
