import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import https from 'https';

import { APIGatewayEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import postMessageToConnection from './lib/post-message-to-connection';
import { URL } from 'url';

const dbUsEast1Client = new DynamoDBClient({ region: 'us-east-1' });
const ddbUsEast1DocClient = DynamoDBDocumentClient.from(dbUsEast1Client);

const dbUsEast2Client = new DynamoDBClient({ region: 'us-east-2' });
const ddbUsEast2DocClient = DynamoDBDocumentClient.from(dbUsEast2Client);

const saveMessageData = async (msg: any) => {
  const {
    Pair,
    TimeStamp,
    Bid,
    Ask,
  } = msg;
  if (Pair && TimeStamp && Bid && Ask) {
    const d = new Date(TimeStamp);
    const ScrapeDate = d.toISOString().split('T')[0];
    const ScrapeTime = d.toISOString().split('T')[1].split('.')[0];
    await ddbUsEast2DocClient.send(
      new PutCommand({
        TableName: process.env.TGSR_DDB_SPOT_PRICES_TABLE_NAME,
        Item: {
          ScrapeDate,
          ScrapeTime,
          AskPrice: Ask,
          BidPrice: Bid,
        },
      }),
    );
  }
};

export async function handler(event: APIGatewayEvent) {
  console.log('incoming event:');
  console.log(event);

  const {
    body,
  } = event;
  let isHeartbeatMessage = false;

  if (body) {
    isHeartbeatMessage = body.toLowerCase() === 'h';
    if (!isHeartbeatMessage) {
      try {
        const parsedMsg = JSON.parse(body);
        saveMessageData(parsedMsg);
      } catch (err) {
        return {
          statusCode: 401,
        };
      }
      await broadcastToLiveConnections(event);
    }
  }

  return {
    statusCode: 200,
  };
}

const broadcastToLiveConnections = async (event: APIGatewayEvent) => {
  const domain = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  const connectionId = event.requestContext.connectionId;
  const callbackUrl = `https://${domain}/${stage}`;
  const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });

  const apiEndpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  console.log(`api endpoint: ${apiEndpoint}`);

  // fetch all connections from dynamodb
  let connections;
  try {
    const response = await ddbUsEast1DocClient.send(
      new ScanCommand({
        TableName: process.env.CONNECTIONS_TBL,
      }),
    );
    connections = response.Items || [];
  } catch (err) {
    console.log(`Failed scanning table ${process.env.CONNECTIONS_TBL}`);
    console.log(err);
    throw err;
  }

  console.log(`sending connection: ${event.requestContext.connectionId}`);

  // broadcast message back to all connections, except the incoming one
  const filteredConnections = connections?.filter(c => c.connectionId !== event.requestContext.connectionId);
  console.log(`all other connections:
  ${JSON.stringify(filteredConnections, null, 2)}
  `);

  let responseBody = '';
  for (let connection of filteredConnections!) {
    try {
      /*
        const command = new PostToConnectionCommand({
          Data: Buffer.from('Hello'),
          ConnectionId: connection.connectionId,
        });
      
        try {
          await client.send(command);
        } catch (error) {
          console.log(JSON.stringify(error, null, 2));
        }
        */
      console.log(`attempting to send message to: ${connection.connectionId}`);
      responseBody += await postMessageToConnection({
        connectionId: connection.connectionId,
        message: event.body || JSON.stringify({ message: 'none' }),
        apiUrl: new URL(`${apiEndpoint}/@connections/${connection.connectionId}`),
        region: process.env.REGION!,
        contentType: 'application/json',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN!,
      });
      console.log(`response from connection post: ${JSON.stringify(responseBody, null, 2)}`);
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }
};

/*
{
  requestContext: {
    routeKey: '$default',
    messageId: 'QwvSIfXwIAMCFUg=',
    eventType: 'MESSAGE',
    extendedRequestId: 'QwvSIHfmIAMFuMA=',
    requestTime: '30/Dec/2023:14:41:17 +0000',
    messageDirection: 'IN',
    stage: 'wss',
    connectedAt: 1703947267303,
    requestTimeEpoch: 1703947277331,
    identity: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      sourceIp: '108.50.153.218'
    },
    requestId: 'QwvSIHfmIAMFuMA=',
    domainName: 'i1ixfhsplb.execute-api.us-east-1.amazonaws.com',
    connectionId: 'QwvQkfUvIAMCFUg=',
    apiId: 'i1ixfhsplb'
  },
  body: '{"h":1,"l":0,"o":0.75,"c":0.8,"v":120004}',
  isBase64Encoded: false
}
*/