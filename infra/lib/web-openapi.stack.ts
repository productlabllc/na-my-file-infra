import {
  NestedStack,
  aws_codeartifact as codeartifact,
  aws_ssm as ssm,
  aws_route53 as r53,
  aws_rds as rds,
  aws_s3 as s3,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfrontOrigins,
  aws_ec2 as ec2,
  aws_certificatemanager as acm,
  aws_logs as logs,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExtendedNestedStackProps, ExtendedStackProps } from './stack-interfaces';

export class WebOpenApiStack extends NestedStack {
  public readonly bucketWebOpenApi: s3.Bucket;
  public readonly webOpenApiDomainName: string;
  public readonly cloudfrontDistributionWebOpenApi: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const { fqdn, wildcardCert, hostedZone, appMetadata, deploymentTarget, getFormattedResourceName } = props;

    // S3 Buckets
    this.bucketWebOpenApi = new s3.Bucket(this, getFormattedResourceName('bucket-web-openapi'), {
      bucketName: getFormattedResourceName('bucket-web-openapi'),
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Cloudfront & WebApp
    const subdomainRecordName = getFormattedResourceName('openapi');
    this.webOpenApiDomainName = `${subdomainRecordName}.${fqdn}`;
    this.cloudfrontDistributionWebOpenApi = new cloudfront.Distribution(this, getFormattedResourceName('cloudfront-web-openapi'), {
      // certificate: wildcardCert,
      // domainNames: [this.webOpenApiDomainName],
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(this.bucketWebOpenApi),
      },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
    // const webappCnameRecord = new r53.CnameRecord(this, getFormattedResourceName('r53-cname-cfdist-web-openapi'), {
    //   domainName: this.cloudfrontDistributionWebOpenApi.distributionDomainName,
    //   zone: hostedZone!,
    //   recordName: subdomainRecordName,
    // });

    // SSM Parameters
    new ssm.StringParameter(this, getFormattedResourceName('param-web-openapi-bucketname'), {
      stringValue: this.bucketWebOpenApi.bucketName,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/openapi-ui-bucketname`,
    });

    /*
    new ssm.StringParameter(this, getFormattedResourceName('param-cloudfront-openapi-dist-id'), {
      stringValue: this.cloudfrontDistributionWebOpenApi.distributionId,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/openapi-cloudfront-dist-id`,
    });
    */
  }
}
