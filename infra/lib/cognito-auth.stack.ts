import {
  Stack,
  StackProps,
  aws_ssm as ssm,
  aws_route53 as r53,
  aws_cognito as cognito,
  aws_lambda_nodejs as lambdaNodeJs,
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
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CognitoAuthStack extends NestedStack {
  constructor(scope: Construct, id: string, props: ExtendedNestedStackProps) {
    super(scope, id, props);

    // Setup
    const { deploymentTarget, awsRegion, appMetadata, getFormattedResourceName, fqdn } = props;
    const orgNameAbbv = appMetadata.OrgNameAbbv.replace(/[ \.]/g, '-');
    const authSubdomain = 'auth'; //deploymentTarget === 'prod' ? 'auth' : `auth-${deploymentTarget}`;
    const resourceSuffix = `-${orgNameAbbv}-${deploymentTarget}`;

    // Cognito
    const preSignupLambdaFn = new lambdaNodeJs.NodejsFunction(
      this,
      getFormattedResourceName('my-file-auth-presignup-lambda-trigger'),
      {
        runtime: Runtime.NODEJS_LATEST,
        entry: join(process.cwd(), './src/cognito-trigger-presignup.ts'),
      },
    );
    const userPool = new cognito.UserPool(this, getFormattedResourceName('na-auth-userpool'), {
      userPoolName: getFormattedResourceName('na-auth-userpool'),
      signInCaseSensitive: false, // case insensitive is preferred in most situations
      selfSignUpEnabled: true,
      autoVerify: {
        email: false,
        phone: false,
      },
      mfa: Mfa.OPTIONAL,
      signInAliases: {
        username: false,
        email: true,
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
        emailSubject: 'Verify Your Account with the My File Application',
        emailBody: 'The verification code to the My File Application is <b>{####}</b>.',
      },
      userInvitation: {
        emailSubject: 'Password Reset with My File',
        emailBody: `Your password to access the My File Application, with the username ({username}), has been reset. <br/><br/>
        Please use the temporary password to login: <br/>
        <b>{####}</b>`,
      },
      // email: cognito.UserPoolEmail.withSES({
      //   sesRegion: this.region,
      //   fromEmail: 'support@newamerica.org',
      //   fromName: 'New America',
      //   replyTo: 'support@newamerica.org',
      //   sesVerifiedDomain: 'newamerica.org',
      // }),
      passwordPolicy: {
        minLength: 10,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: true,
      },
      lambdaTriggers: {
        preSignUp: preSignupLambdaFn,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const userPoolAuthDomain = `${authSubdomain}.${fqdn}`;
    const userPoolDomain = new cognito.UserPoolDomain(this, getFormattedResourceName('na-user-pool-domain'), {
      userPool,
      // customDomain: {
      //   certificate: props.wildcardCert!,
      //   domainName: userPoolAuthDomain,
      // },
      cognitoDomain: {
        domainPrefix: 'na-my-file-auth', // currently set to this domain prefix
      },
    });
    // const authHostCname = new r53.CnameRecord(this, getFormattedResourceName('r53-cname-record-auth'), {
    //   domainName: userPoolDomain.cloudFrontDomainName,
    //   zone: props.hostedZone!,
    //   recordName: authSubdomain,
    // });
    const userPoolClient = userPool.addClient(getFormattedResourceName('auth-user-pool-client'), {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        // callbackUrls: [`https://${userPoolAuthDomain}`, `https://${userPoolAuthDomain}/callback`],
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        // logoutUrls: [`https://${userPoolAuthDomain}`],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
    });

    // SSM Parameters
    new ssm.StringParameter(this, getFormattedResourceName('ssm-cognito-arn'), {
      stringValue: userPool.userPoolArn,
      parameterName: getFormattedResourceName('cognito-arn'),
    });
    new ssm.StringParameter(this, getFormattedResourceName('ssm-cognito-clientid'), {
      stringValue: userPoolClient.userPoolClientId,
      parameterName: getFormattedResourceName('cognito-clientid'),
    });
    new ssm.StringParameter(this, getFormattedResourceName('ssm-cognito-userpoolid'), {
      stringValue: userPool.userPoolId,
      parameterName: getFormattedResourceName('cognito-userpoolid'),
    });
    new ssm.StringParameter(this, getFormattedResourceName('ssm-cognito-userpoolurl'), {
      stringValue: userPool.userPoolProviderUrl,
      parameterName: getFormattedResourceName('cognito-userpoolurl'),
    });
  }
}
