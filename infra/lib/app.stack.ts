import {
  NestedStack,
  aws_ssm as ssm,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaNodeJS,
  aws_events,
  aws_events_targets,
  aws_sqs as sqs,
  Duration,
} from 'aws-cdk-lib';
import * as apigV2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigV2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigV2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { ExtendedNestedStackProps, ExtendedStackProps } from './stack-interfaces';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Schedule } from 'aws-cdk-lib/aws-events';

export class AppStack extends NestedStack {

  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const { deploymentTarget, appMetadata, vpc, getFormattedResourceName } = props;

    const { AWS_ACCESS_KEY_ID = '', AWS_SECRET_ACCESS_KEY = '' } = process.env;

    // Additional DynamoDB Tables
    const {
      TGSR_DDB_SPOT_PRICES_TABLE_ARN = '',
      MT4_SQLSVR_CONNECTION_JSON = '',
    } = process.env;
    const ddbTgsrSpotPricesTbl = dynamodb.Table.fromTableArn(this, getFormattedResourceName('ddb-tgsr-spot-prices-tbl'), TGSR_DDB_SPOT_PRICES_TABLE_ARN);

    const mt4DataHandler = new lambdaNodeJS.NodejsFunction(
      this,
      getFormattedResourceName('mt4-data-handler'),
      {
        functionName: getFormattedResourceName('mt4-price-handler'),
        entry: 'src/mt4-price-handler.ts',
        // vpc,
        environment: {
          REGION: this.region,
          TGSR_DDB_SPOT_PRICES_TABLE_NAME: ddbTgsrSpotPricesTbl.tableName,
          TGSR_DDB_SPOT_PRICES_TABLE_REGION: ddbTgsrSpotPricesTbl.env.region,
          DB_CREDS: MT4_SQLSVR_CONNECTION_JSON,
          ...props.additionalEnvironmentVariables,
        },
        bundling: {
          nodeModules: [
            'prisma',
            '@prisma/client',
          ],
          commandHooks: {
            beforeBundling(inputDir: string, outputDir: string): string[] {
              return [];
            },
            beforeInstall(inputDir: string, outputDir: string) {
              return [`cp -R ./prisma ${outputDir}/`];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
              return [
                // `cd ${outputDir}`,
                // 'npm ci',
                // `cp -R ${inputDir}/node_modules/prisma ${outputDir}/`,
                `npx prisma generate`,
                `rm -rf ${outputDir}/node_modules/@prisma/engines`,
                'find . -type f -name \'*libquery_engine-darwin*\' -exec rm {} +',
                `find ${outputDir}/node_modules/prisma -type f -name \'*libquery_engine*\' -exec rm {} +`,
              ];
            },
          },
        },
        timeout: Duration.seconds(90),
      },
    );

    // DynamoDB Tables granting permissions to ws lambdas
    ddbTgsrSpotPricesTbl.grantReadWriteData(mt4DataHandler);

    // Add permissions to SQS Queue for broadcasting websocket messages
    props.broadcastMessageSqsQueue!.grantSendMessages(mt4DataHandler);

    const scheduledEvent = new aws_events.Rule(this, getFormattedResourceName('mt4-price-job-trigger'), {
      enabled: true,
      description: 'Scheduled timer to trigger retrieval of MT4 price data.',
      ruleName: getFormattedResourceName('mt4-price-job-trigger'),
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [new aws_events_targets.LambdaFunction(mt4DataHandler)],
    })
  }
}
