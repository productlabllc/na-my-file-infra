import {
  Stack,
  StackProps,
  aws_ssm as ssm,
  aws_route53 as r53,
  aws_ec2 as ec2,
  aws_logs as logs,
  aws_rds as rds,
  aws_elasticache as elasticache,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
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

export class RdsPostgresqlStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    // Setup
    const { deploymentTarget, awsRegion, appMetadata, getFormattedResourceName, vpc, isProdDeployment, hostedZone } =
      props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const fqdn = 'newamerica.org';
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;

    // Databases
    const dbSecurityGroup = new ec2.SecurityGroup(this, `rds-postgres-securitygroup-${resourceSuffix}`, {
      vpc: vpc!,
      securityGroupName: `rds-postgres-securitygroup-${deploymentTarget}`,
    });
    dbSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      'RDS Postgres Security Group: Any private ip address ingress.',
    );
    const postgresInstance = isProdDeployment
      ? new rds.DatabaseCluster(this, `rds-postgres-instance${resourceSuffix}`, {
          engine: rds.DatabaseClusterEngine.auroraPostgres({
            version: rds.AuroraPostgresEngineVersion.VER_17_2,
          }),
          writer: rds.ClusterInstance.provisioned('writer', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE),
          }),
          readers: [
            // will be put in promotion tier 1 and will scale with the writer
            rds.ClusterInstance.serverlessV2('reader01', {
              scaleWithWriter: true,
              allowMajorVersionUpgrade: true,
              enablePerformanceInsights: true,
              instanceIdentifier: 'reader01',
            }),
            rds.ClusterInstance.serverlessV2('reader02', {
              scaleWithWriter: true,
              allowMajorVersionUpgrade: true,
              enablePerformanceInsights: true,
              instanceIdentifier: 'reader02',
            }),
            rds.ClusterInstance.serverlessV2('reader03', {
              scaleWithWriter: true,
              allowMajorVersionUpgrade: true,
              enablePerformanceInsights: true,
              instanceIdentifier: 'reader03',
            }),
          ],
          vpc,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          cloudwatchLogsRetention: logs.RetentionDays.FIVE_DAYS,
          defaultDatabaseName: 'main',
          instanceIdentifierBase: `core-db${resourceSuffix}`,
          removalPolicy: RemovalPolicy.RETAIN,
          securityGroups: [dbSecurityGroup],
        })
      : new rds.DatabaseInstance(this, `rds-postgres-instance${resourceSuffix}`, {
          engine: rds.DatabaseInstanceEngine.postgres({
            version: rds.PostgresEngineVersion.VER_17_2,
          }),
          vpc: vpc!,
          vpcSubnets: {
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          },
          cloudwatchLogsRetention: logs.RetentionDays.FIVE_DAYS,
          databaseName: 'main',
          instanceIdentifier: `core-db${resourceSuffix}`,
          removalPolicy: RemovalPolicy.SNAPSHOT,
          securityGroups: [dbSecurityGroup],
          instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
        });
    // const dnsRecordPostgresCname = new r53.CnameRecord(this, `r53-cname-record-postgres${resourceSuffix}`, {
    //   domainName: isProdDeployment
    //     ? (postgresInstance as rds.DatabaseCluster).clusterEndpoint.hostname
    //     : (postgresInstance as rds.DatabaseInstance).instanceEndpoint.hostname,
    //   zone: hostedZone!,
    //   recordName: `db-${deploymentTarget}`,
    // });

    if (deploymentTarget === 'dev') {
      // EC2 Bastion for Postgres SSH Tunnel
      const keyPairName = `bastion-host-keypair-main`;
      const keyPair = new KeyPair(this, keyPairName, {
        name: keyPairName,
        description: 'Generated key pair for ssh bastion host',
        secretPrefix: keyPairName,
        resourcePrefix: `keypair-main`,
      });
      const bastionSecurityGroup = new ec2.SecurityGroup(this, `ec2-bastionhost-securitygroup-main`, {
        vpc: vpc!,
        allowAllOutbound: true,
      });
      bastionSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH access from anywhere');
      const bastionInstance = new ec2.Instance(this, 'ec2-bastionhost-main', {
        vpc: vpc!,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.NANO),
        machineImage: new ec2.AmazonLinuxImage(),
        keyName: keyPair.keyPairName,
        securityGroup: bastionSecurityGroup,
      });
      // const dnsRecordBastionHostCname = new r53.CnameRecord(this, `r53-cname-record-bastion-main`, {
      //   domainName: bastionInstance.instancePublicDnsName,
      //   zone: hostedZone!,
      //   recordName: 'bastion',
      // });
      new ssm.StringParameter(this, `ssm-bastionhost-main-publicdns${resourceSuffix}`, {
        stringValue: bastionInstance.instancePublicDnsName,
        parameterName: `bastionhost-main-publicdns${resourceSuffix}`,
      });
      new ssm.StringParameter(this, `ssm-bastionhost-main-publicip${resourceSuffix}`, {
        stringValue: bastionInstance.instancePublicIp,
        parameterName: `bastionhost-main-publicip${resourceSuffix}`,
      });
    }

    // SSM Parameters
    if (!isProdDeployment) {
      new ssm.StringParameter(this, `ssm-db-main-arn${resourceSuffix}`, {
        stringValue: (postgresInstance as rds.DatabaseInstance).instanceArn,
        parameterName: `db-main-instance-arn${resourceSuffix}`,
      });
    }
    new ssm.StringParameter(this, `ssm-db-main-secret-arn${resourceSuffix}`, {
      stringValue: postgresInstance.secret!.secretArn,
      parameterName: `db-main-secret-arn${resourceSuffix}`,
    });
  }
}
