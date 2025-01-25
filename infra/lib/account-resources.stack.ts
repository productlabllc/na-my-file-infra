import {
  Stack,
  StackProps,
  aws_certificatemanager as acm,
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
import { IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AccountResourcesStack extends NestedStack {
  vpc: IVpc;
  hostedZone: IHostedZone;
  wildcardCert: ICertificate;

  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    // Setup
    const { deploymentTarget, awsRegion, appMetadata, getFormattedResourceName, isProdDeployment, fqdn } = props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const domainName = fqdn;
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;

    // Vpc
    const vpcName = getFormattedResourceName('vpc-main');
    this.vpc = props.existingVpcId
      ? ec2.Vpc.fromLookup(this, vpcName, {
          vpcId: props.existingVpcId,
        })
      : new ec2.Vpc(this, vpcName, {
          vpcName,
        });

    // Certs
    // this.wildcardCert = new acm.Certificate(this, getFormattedResourceName('na-wildcard-cert'), {
    //   domainName: `*.${domainName}`,
    //   certificateName: `na-${deploymentTarget}-wildcard-cert`,
    //   validation: acm.CertificateValidation.fromDns(),
    // });

    // Route53 / DNS
    // const hostedZone = r53.HostedZone.fromHostedZoneAttributes(this, 'hosted-zone', {
    //   hostedZoneId: EXISTING_HOSTED_ZONE_ID,
    //   zoneName: EXISTING_HOSTED_ZONE_NAME,
    // });
    // this.hostedZone = new r53.PublicHostedZone(this, getFormattedResourceName('hosted-zone'), {
    //   zoneName: domainName,
    // });

    // // SSM Parameters
    // new ssm.StringParameter(this, `ssm-hostedzone-main-id${resourceSuffix}`, {
    //   stringValue: this.hostedZone.hostedZoneId,
    //   parameterName: `hostedzone-main-id${resourceSuffix}`,
    // });
    // new ssm.StringParameter(this, `ssm-hostedzone-main-name${resourceSuffix}`, {
    //   stringValue: this.hostedZone.zoneName,
    //   parameterName: `hostedzone-main-name${resourceSuffix}`,
    // });
    // new ssm.StringParameter(this, `ssm-wildcard-cert-arn${resourceSuffix}`, {
    //   stringValue: this.wildcardCert.certificateArn,
    //   parameterName: `wildcard-cert-arn${resourceSuffix}`,
    // });
    new ssm.StringParameter(this, `ssm-vpc-id${resourceSuffix}`, {
      stringValue: this.vpc.vpcId,
      parameterName: `vpc-id${resourceSuffix}`,
    });
  }
}
