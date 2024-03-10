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
import * as apigV2Alpha from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { AppMetadata } from '../config';
import { Mfa } from 'aws-cdk-lib/aws-cognito';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { ExtendedNestedStackProps } from './stack-interfaces';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ApiStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    // Setup
    const {
      deploymentTarget,
      awsRegion,
      appMetadata,
      getFormattedResourceName,
      vpc,
      isProdDeployment,
      hostedZone,
      wildcardCert,
      fqdn,
    } = props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;

    // API Gateway
    const apiSubdomain = isProdDeployment ? `platform-api` : `platform-api-${deploymentTarget}`;
    // const apiGatewayDomainName = new apigV2Alpha.DomainName(this, `apigateway-domain-name${resourceSuffix}`, {
    //   certificate: wildcardCert!,
    //   domainName: `${apiSubdomain}.${fqdn}`,
    //   certificateName: `wildcard-cert${resourceSuffix}`,
    // });
    const httpApi = new apigV2Alpha.HttpApi(this, `http-api-core${resourceSuffix}`, {
      apiName: `${orgNameAbbv}-core-api-${deploymentTarget}`,
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [
          apigV2Alpha.CorsHttpMethod.DELETE,
          apigV2Alpha.CorsHttpMethod.GET,
          apigV2Alpha.CorsHttpMethod.HEAD,
          apigV2Alpha.CorsHttpMethod.OPTIONS,
          apigV2Alpha.CorsHttpMethod.PATCH,
          apigV2Alpha.CorsHttpMethod.POST,
          apigV2Alpha.CorsHttpMethod.PUT,
        ],
        allowOrigins: ['*'],
        // allowCredentials: true,
      },
    });
    // const dnsRecordApigatewayCname = new r53.CnameRecord(this, `r53-cname-record-apigateway${resourceSuffix}`, {
    //   domainName: httpApi.apiEndpoint,
    //   zone: hostedZone!,
    //   recordName: apiSubdomain,
    // });

    // SSM Parameters
    new ssm.StringParameter(this, `ssm-httpapi-main-id${resourceSuffix}`, {
      stringValue: httpApi.httpApiId,
      parameterName: `httpapi-main-id${resourceSuffix}`,
    });
    new ssm.StringParameter(this, `ssm-httpapi-endpoint${resourceSuffix}`, {
      stringValue: httpApi.apiEndpoint,
      parameterName: `httpapi-endpoint${resourceSuffix}`,
    });
  }
}
