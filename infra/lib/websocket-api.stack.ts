import {
  NestedStack,
  aws_ssm as ssm,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaNodeJS,
  aws_sqs as sqs,
  RemovalPolicy,
} from 'aws-cdk-lib';
import * as apigV2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigV2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigV2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { ExtendedNestedStackProps, ExtendedStackProps } from './stack-interfaces';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class WebsocketApiStack extends NestedStack {
  public readonly apiGatewayDomainName: apigV2.DomainName;
  public readonly websocketApi: apigV2.WebSocketApi;
  public readonly dynamodbWebsocketConnectionTable: dynamodb.Table;
  public readonly wsConnectHandler: lambdaNodeJS.NodejsFunction;
  public readonly wsDisconnectHandler: lambdaNodeJS.NodejsFunction;
  public readonly wsMessageHandler: lambdaNodeJS.NodejsFunction;
  public readonly wsBroadcastMessageHandler: lambdaNodeJS.NodejsFunction;
  public readonly sqsBroadcastMessageQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: ExtendedStackProps) {
    super(scope, id, props);

    const { deploymentTarget, appMetadata, vpc, getFormattedResourceName } = props;

    const { AWS_ACCESS_KEY_ID = '', AWS_SECRET_ACCESS_KEY = '' } = process.env;

    // DynamoDB Table for managing Websocket Client Connections
    this.dynamodbWebsocketConnectionTable = new dynamodb.Table(
      this,
      getFormattedResourceName('ws-client-connections-table'),
      {
        tableName: getFormattedResourceName('ws-client-connections-table'),
        partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
        readCapacity: 2,
        writeCapacity: 1,
        timeToLiveAttribute: 'ttl',
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );

    // SQS Queue as event source for broadcasting messages
    this.sqsBroadcastMessageQueue = new sqs.Queue(
      this,
      getFormattedResourceName('sqsqueue-broadcast-message-event-source'),
      {
        queueName: getFormattedResourceName('ws-broadcast-message-queue'),
      },
    );

    // Lambda - websocket connection and message handlers
    this.wsConnectHandler = new lambdaNodeJS.NodejsFunction(this, getFormattedResourceName('ws-connect-handler'), {
      functionName: getFormattedResourceName('ws-connect-handler'),
      entry: 'src/websocket-onconnect.ts',
      vpc,
      environment: {
        CONNECTIONS_TBL: this.dynamodbWebsocketConnectionTable.tableName,
        REGION: this.region,
      },
    });
    const wsConnectAuthorizerHandler = new lambdaNodeJS.NodejsFunction(
      this,
      getFormattedResourceName('ws-connect-authorizer-handler'),
      {
        functionName: getFormattedResourceName('ws-connect-authorizer-handler'),
        entry: 'src/websocket-onconnect-authorizer.ts',
        vpc,
        environment: {
          CONNECTIONS_TBL: this.dynamodbWebsocketConnectionTable.tableName,
          REGION: this.region,
        },
        runtime: Runtime.NODEJS_LATEST,
      },
    );
    this.wsDisconnectHandler = new lambdaNodeJS.NodejsFunction(
      this,
      getFormattedResourceName('ws-disconnect-handler'),
      {
        functionName: getFormattedResourceName('ws-disconnect-handler'),
        entry: 'src/websocket-ondisconnect.ts',
        vpc,
        environment: {
          CONNECTIONS_TBL: this.dynamodbWebsocketConnectionTable.tableName,
          REGION: this.region,
        },
        runtime: Runtime.NODEJS_LATEST,
      },
    );
    this.wsMessageHandler = new lambdaNodeJS.NodejsFunction(
      this,
      getFormattedResourceName('ws-receive-message-handler'),
      {
        functionName: getFormattedResourceName('ws-receive-message-handler'),
        entry: 'src/websocket-onmessage.ts',
        // vpc,
        environment: {
          CONNECTIONS_TBL: this.dynamodbWebsocketConnectionTable.tableName,
          REGION: this.region,
        },
        runtime: Runtime.NODEJS_LATEST,
      },
    );
    this.wsBroadcastMessageHandler = new lambdaNodeJS.NodejsFunction(
      this,
      getFormattedResourceName('ws-broadcast-message-handler'),
      {
        functionName: getFormattedResourceName('ws-broadcast-message-handler'),
        entry: 'src/websocket-broadcast-message.ts',
        // vpc,
        environment: {
          CONNECTIONS_TBL: this.dynamodbWebsocketConnectionTable.tableName,
          REGION: this.region,
          QUEUE_URL: this.sqsBroadcastMessageQueue.queueUrl,
        },
        events: [new SqsEventSource(this.sqsBroadcastMessageQueue)],
        runtime: Runtime.NODEJS_LATEST,
      },
    );
    this.sqsBroadcastMessageQueue.grantConsumeMessages(this.wsBroadcastMessageHandler);
    this.dynamodbWebsocketConnectionTable.grantFullAccess(this.wsConnectHandler);
    this.dynamodbWebsocketConnectionTable.grantFullAccess(this.wsDisconnectHandler);
    this.dynamodbWebsocketConnectionTable.grantFullAccess(this.wsMessageHandler);
    this.dynamodbWebsocketConnectionTable.grantFullAccess(this.wsBroadcastMessageHandler);

    // Websocket API Gateway
    this.websocketApi = new apigV2.WebSocketApi(this, getFormattedResourceName('websocketapi'), {
      apiName: getFormattedResourceName('websocketapi'),
      connectRouteOptions: {
        integration: new apigV2Integrations.WebSocketLambdaIntegration(
          getFormattedResourceName('ws-connect-integration'),
          this.wsConnectHandler,
        ),
        // authorizer: new apigV2Authorizers.WebSocketLambdaAuthorizer(getFormattedResourceName('ws-connect-authorizer'), wsConnectAuthorizerHandler, {
        //   // identitySource: ['route.request.header.Authorization'],
        // })
      },
      disconnectRouteOptions: {
        integration: new apigV2Integrations.WebSocketLambdaIntegration(
          getFormattedResourceName('ws-disconnect-integration'),
          this.wsDisconnectHandler,
        ),
      },
      defaultRouteOptions: {
        integration: new apigV2Integrations.WebSocketLambdaIntegration(
          getFormattedResourceName('ws-defaultroute-integration'),
          this.wsMessageHandler,
        ),
      },
    });
    this.websocketApi.addRoute('broadcast', {
      integration: new apigV2Integrations.WebSocketLambdaIntegration(
        getFormattedResourceName('ws-broadcast-integration'),
        this.wsBroadcastMessageHandler,
      ),
    });
    const websocketApiStage = new apigV2.WebSocketStage(this, getFormattedResourceName('ws-api-stage'), {
      webSocketApi: this.websocketApi,
      stageName: 'wss',
      autoDeploy: true,
    });
    const connectionsArns = this.formatArn({
      service: 'execute-api',
      resourceName: `*/*/@connections/*`,
      resource: this.websocketApi.apiId,
    });

    this.wsMessageHandler.addToRolePolicy(
      new PolicyStatement({ actions: ['execute-api:ManageConnections'], resources: [connectionsArns] }),
    );
    this.wsBroadcastMessageHandler.addToRolePolicy(
      new PolicyStatement({ actions: ['execute-api:ManageConnections'], resources: [connectionsArns] }),
    );
    this.wsBroadcastMessageHandler.addEnvironment(
      'BASE_CONNECTIONS_POST_URL',
      `https://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${websocketApiStage.stageName}/`,
    );

    // SSM Parameters
    new ssm.StringParameter(this, `param-websocketapi-id`, {
      stringValue: this.websocketApi.apiId,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/websocketapi-id`,
    });
    new ssm.StringParameter(this, `param-websocketapi-endpoint`, {
      stringValue: this.websocketApi.apiEndpoint,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/websocketapi-endpoint`,
    });
    new ssm.StringParameter(this, `param-sqs-broadcast-message-queuearn`, {
      stringValue: this.sqsBroadcastMessageQueue.queueArn,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/sqs-broadcast-message-queuearn`,
    });
    new ssm.StringParameter(this, `param-sqs-broadcast-message-queueurl`, {
      stringValue: this.sqsBroadcastMessageQueue.queueUrl,
      parameterName: `/${appMetadata.AppName}/${deploymentTarget}/sqs-broadcast-message-queueurl`,
    });
  }
}
