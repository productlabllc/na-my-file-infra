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
import { getDB } from "./lib/db";
import { tblName } from "@prisma/client";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const dbUsEast2Client = new DynamoDBClient({ region: 'us-east-2' });
const ddbUsEast2DocClient = DynamoDBDocumentClient.from(dbUsEast2Client);

const savePriceDataToDynamo = async (msg: tblName) => {
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

const sendToBroadcastMessageQueue = async (message: string) => {
  const client = new SQSClient({});
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_BROADCAST_MSG_QUEUE_URL!,
    MessageBody: JSON.stringify({ connectionIds: '', connectionIdScope: '', message, origin: '' }),
  });
  return client.send(command);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handler(event: any) {
  console.log('incoming event:');
  console.log(event);

  const {
    body,
  } = event;

  const db = getDB();
  let lastPrice: tblName | undefined;
  for (let i=0; i<12; i++) {
    const currPrice = await db.tblName.findFirst({
      orderBy: {
        TimeStamp: 'desc',
      }
    });
    console.log(`Current Price:
    ${JSON.stringify(currPrice, null, 2)}
    `);
    if (currPrice && currPrice.NameID !== lastPrice?.NameID) {
      lastPrice = currPrice;
      await savePriceDataToDynamo(currPrice);
      const { NameID, SentToWebSocket, Username, ...QueueMsg } = currPrice;
      const sendMsgResult = await sendToBroadcastMessageQueue(JSON.stringify(QueueMsg));
      console.log(`Queue Result:
      ${JSON.stringify(sendMsgResult, null, 2)}
      `);
    }
    await sleep(5000);
  }

  return {
    statusCode: 200,
  };
}
