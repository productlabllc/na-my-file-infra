import {
  CfnOutput,
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
  aws_waf as waf,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ExtendedNestedStackProps, ExtendedStackProps } from './stack-interfaces';
// import { WafwebaclToCloudFront } from '@aws-solutions-constructs/aws-wafwebacl-cloudfront';

export class AppWebUIStack extends NestedStack {
  public readonly bucketWebApp: s3.Bucket;
  public readonly webappDomainName: string;
  public readonly cloudfrontDistributionWebApp: cloudfront.Distribution;
  public readonly wafWebAcl?: waf.CfnWebACL;
  public readonly wafIpSet?: waf.CfnIPSet;
  // public readonly cloudfrontWafAcl?: WafwebaclToCloudFront;

  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    const { fqdn, wildcardCert, deploymentTarget, appMetadata, getFormattedResourceName } = props;

    const { WEB_ACL_IP_WHITELIST } = process.env;

    // Hosted Zone
    // let hostedZone: r53.IHostedZone | undefined = props.hostedZone;
    // if (props.hostedZone) {
    //   hostedZone = props.hostedZone;
    // } else if (props.existingHostedZoneId && props.existingHostedZoneName) {
    //   hostedZone = r53.HostedZone.fromHostedZoneAttributes(this, getFormattedResourceName('hosted-zone'), {
    //     hostedZoneId: props.existingHostedZoneId,
    //     zoneName: props.existingHostedZoneName,
    //   });
    // } else if (props.createNewHostedZone) {
    //   hostedZone = new r53.PublicHostedZone(this, getFormattedResourceName('hosted-zone'), {
    //     zoneName: fqdn,
    //   });
    // }

    // S3 Bucket
    this.bucketWebApp = new s3.Bucket(this, getFormattedResourceName('bucket-newamerica-web-ui'), {
      bucketName: getFormattedResourceName('bucket-newamerica-web-ui'),
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ACM
    // const acmWildcardCert =
    //   wildcardCert ||
    //   new acm.Certificate(this, getFormattedResourceName('acm-cert'), {
    //     domainName: `*.${fqdn}`,
    //   });

    // Cloudfront & WebApp
    const subdomainName = deploymentTarget === 'prod' ? '' : `ui.`;
    this.webappDomainName = `${subdomainName}${fqdn}`;
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, getFormattedResourceName('cloudfront-oai'), {
      comment: 'Cloudfront S3 Origin Access Identity for New America UI',
    });
    this.bucketWebApp.grantRead(originAccessIdentity);
    this.cloudfrontDistributionWebApp = new cloudfront.Distribution(
      this,
      getFormattedResourceName('cloudfront-newamerica-web-ui'),
      {
        // certificate: acmWildcardCert,
        // domainNames: [this.webappDomainName],
        defaultBehavior: {
          origin: new cloudfrontOrigins.S3Origin(this.bucketWebApp, {
            originAccessIdentity,
          }),
        },
        defaultRootObject: 'index.html',
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        errorResponses: [
          {
            httpStatus: 404,
            responsePagePath: '/index.html',
          },
        ],
      },
    );
    // const webappCnameRecord = new r53.CnameRecord(this, getFormattedResourceName('r53-cname-cfdist-web-ui'), {
    //   domainName: this.cloudfrontDistributionWebApp.distributionDomainName,
    //   zone: hostedZone!,
    //   recordName: subdomainName.replace('.', ''),
    // });

    // WAF - Web ACL
    /*
    const setupWebAcl = (ipWhitelist: Array<string>, scope: Construct) => {
      // IP Set
      const wafIpSet = new waf.CfnIPSet(scope, getFormattedResourceName('waf-ipset'), {
        name: 'ipset-whitelist-iac',
        ipSetDescriptors: ipWhitelist.map(ipv4Address => ({ type: 'IPV4', value: ipv4Address })),
      });
      console.log(`--- WAF IPSET ---
      name: ${wafIpSet.name}
      logicalId: ${wafIpSet.logicalId}
      ref: ${wafIpSet.ref}
      `);
      const ipsetArn = new CfnOutput(scope, 'ipset-cfn-output', {
        value: wafIpSet.ref,
      });
      const wafWebAcl = new WafwebaclToCloudFront(this, 'test-wafwebacl-cloudfront', {
        existingCloudFrontWebDistribution: this.cloudfrontDistributionWebApp,
        webaclProps: {
          defaultAction: {
            allow: {},
          },
          scope: 'CLOUDFRONT',
          visibilityConfig: {
            cloudWatchMetricsEnabled: false,
            metricName: 'webACL',
            sampledRequestsEnabled: true
          },
          rules: [
            {
              name: 'rule-restrict-traffic-to-corp-vpn',
              priority: 0,
              statement: {
                notStatement: {
                  statement: {
                    ipSetReferenceStatement: {
                      arn: 'arn:aws:wafv2:us-east-1:531381891715:global/ipset/juniper-corp-vpn-gateway/0e2cf8a9-f624-4a06-97c9-7557cca786f2',
                    },
                  },
                },
              },
              action: {
                block: {
                  customResponse: {
                    responseCode: 403,
                  },
                },
              },
              visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'rule-restrict-traffic-to-juniper-corp-vpn',
              },
            },
          ],
        },
      });
      wafWebAcl.node.addDependency(wafIpSet);
      return { wafIpSet, wafWebAcl };
    };
    const ipv4ListRx = /^(((\d{1,3}\.){3}\d{1,3}\/\d{1,3}),?){1,}$/;
    if (WEB_ACL_IP_WHITELIST && ipv4ListRx.test(WEB_ACL_IP_WHITELIST)) {
      const wafResources = setupWebAcl(WEB_ACL_IP_WHITELIST.split(','), this);
      this.wafIpSet = wafResources.wafIpSet;
      this.cloudfrontWafAcl = wafResources.wafWebAcl;
    }
    */

    // SSM Parameters
    const uiBucketParamName = `/${appMetadata.AppName}/${deploymentTarget}/newamerica-web-ui-bucketname`;
    new ssm.StringParameter(this, getFormattedResourceName('param-newamerica-web-ui-bucketname'), {
      stringValue: this.bucketWebApp.bucketName,
      parameterName: uiBucketParamName,
    });
    const cloudfrontDistributionParamName = `/${appMetadata.AppName}/${deploymentTarget}/newamerica-web-ui-cloudfront-dist-id`;
    new ssm.StringParameter(this, getFormattedResourceName('param-newamerica-web-ui-cloudfront-dist-id'), {
      stringValue: this.cloudfrontDistributionWebApp.distributionId,
      parameterName: cloudfrontDistributionParamName,
    });
    // const uiUrlParamName = `/${appMetadata.AppName}/${deploymentTarget}/partner-portal-webui-url`;
    // new ssm.StringParameter(this, getFormattedResourceName('param-partner-portal-webui-url'), {
    //   stringValue: webappCnameRecord.domainName,
    //   parameterName: uiUrlParamName,
    // });
  }
}
