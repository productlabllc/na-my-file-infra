import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export async function handler(event: any, context: Context): Promise<APIGatewayProxyResultV2> {
  console.log(`event = ${JSON.stringify(event)}`);
  console.log(`context = ${JSON.stringify(context)}`);
  console.log(`process.env = ${JSON.stringify(process.env)}`);

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.CONNECTIONS_TBL,
        Item: {
          connectionId: event.requestContext.connectionId,
          ttl: Math.floor(Date.now() / 1000 + 60 * 60 * 3), // 3 hour ttl
        },
      }),
    );
  } catch (err) {
    console.log(err);
    throw err;
  }

  return {
    statusCode: 200,
  };
}

/* Example Websocket API Gateway Event Message Payload
{
    "headers": {
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Host": "i1ixfhsplb.execute-api.us-east-1.amazonaws.com",
        "Origin": "chrome://new-tab-page",
        "Pragma": "no-cache",
        "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits",
        "Sec-WebSocket-Key": "eRozn4VJ1NCrZWmf0KNjVQ==",
        "Sec-WebSocket-Version": "13",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Amzn-Trace-Id": "Root=1-65902e46-27196a7c09cdb68f27832566",
        "X-Forwarded-For": "108.50.153.218",
        "X-Forwarded-Port": "443",
        "X-Forwarded-Proto": "https"
    },
    "multiValueHeaders": {
        "Accept-Encoding": [
            "gzip, deflate, br"
        ],
        "Accept-Language": [
            "en-US,en;q=0.9"
        ],
        "Cache-Control": [
            "no-cache"
        ],
        "Host": [
            "i1ixfhsplb.execute-api.us-east-1.amazonaws.com"
        ],
        "Origin": [
            "chrome://new-tab-page"
        ],
        "Pragma": [
            "no-cache"
        ],
        "Sec-WebSocket-Extensions": [
            "permessage-deflate; client_max_window_bits"
        ],
        "Sec-WebSocket-Key": [
            "eRozn4VJ1NCrZWmf0KNjVQ=="
        ],
        "Sec-WebSocket-Version": [
            "13"
        ],
        "User-Agent": [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ],
        "X-Amzn-Trace-Id": [
            "Root=1-65902e46-27196a7c09cdb68f27832566"
        ],
        "X-Forwarded-For": [
            "108.50.153.218"
        ],
        "X-Forwarded-Port": [
            "443"
        ],
        "X-Forwarded-Proto": [
            "https"
        ]
    },
    "queryStringParameters": {
        "apiKey": "test-api-key"
    },
    "multiValueQueryStringParameters": {
        "apiKey": [
            "test-api-key"
        ]
    },
    "requestContext": {
        "routeKey": "$connect",
        "eventType": "CONNECT",
        "extendedRequestId": "QwwrHHJMIAMFarA=",
        "requestTime": "30/Dec/2023:14:50:46 +0000",
        "messageDirection": "IN",
        "stage": "wss",
        "connectedAt": 1703947846882,
        "requestTimeEpoch": 1703947846884,
        "identity": {
            "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "sourceIp": "108.50.153.218"
        },
        "requestId": "QwwrHHJMIAMFarA=",
        "domainName": "i1ixfhsplb.execute-api.us-east-1.amazonaws.com",
        "connectionId": "QwwrHczJoAMCE9Q=",
        "apiId": "i1ixfhsplb"
    },
    "isBase64Encoded": false
}
*/