import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import https from 'https';

import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import postMessageToConnection from './lib/post-message-to-connection';
import { URL } from 'url';

const dbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dbClient);

export async function handler(event: SQSEvent) {
  console.log('incoming event:');
  console.log(event);

  const sqsRecord = event.Records[0];

  // const client = new ApiGatewayManagementApiClient({ endpoint: callbackUrl });
  const apiEndpoint = process.env.BASE_CONNECTIONS_POST_URL!;
  console.log(`api endpoint: ${apiEndpoint}`);

  // fetch all connections from dynamodb
  let connections;
  try {
    const response = await ddbDocClient.send(
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

  // broadcast message back to all connections, except the incoming one
  const filteredConnections = connections?.filter(c => c.connectionId);
  console.log(`filtered connections:
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
      const parsedMessage = JSON.parse(sqsRecord.body);
      responseBody += await postMessageToConnection({
        connectionId: connection.connectionId,
        message: parsedMessage.message || JSON.stringify({ message: 'none' }),
        apiUrl: new URL(`${apiEndpoint}/@connections/${connection.connectionId}`),
        region: process.env.REGION!,
        contentType: 'application/json',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN!,
      });
      console.log(`response from connection post: ${JSON.stringify(responseBody, null, 2)}`);
      const client = new SQSClient({});
      const command = new DeleteMessageCommand({
        ReceiptHandle: sqsRecord.receiptHandle,
        QueueUrl: process.env.QUEUE_URL!,
      });
      const queueResponse = await client.send(command);
      console.log(JSON.stringify(queueResponse));
    } catch (err) {
      console.log(JSON.stringify(err, null, 2));
    }
  }

  return {
    statusCode: 200,
  };
}
