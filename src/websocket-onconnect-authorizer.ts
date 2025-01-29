import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';

export async function handler(event: any, context: Context) {
  console.log(`event = ${JSON.stringify(event)}`);
  console.log(`context = ${JSON.stringify(context)}`);

  // A simple REQUEST authorizer example to demonstrate how to use request
  // parameters to allow or deny a request. In this example, a request is
  // authorized if the client-supplied HeaderAuth1 header and QueryString1 query parameter
  // in the request context match the specified values of
  // of 'headerValue1' and 'queryValue1' respectively.

  // Retrieve request parameters from the Lambda function input:
  const headers = event.headers;
  const queryStringParameters = event.queryStringParameters;
  const stageVariables = event.stageVariables;
  const requestContext = event.requestContext;

  // Parse the input for the parameter values
  const tmp = event.methodArn.split(':');
  const apiGatewayArnTmp = tmp[5].split('/');
  const awsAccountId = tmp[4];
  const region = tmp[3];
  const ApiId = apiGatewayArnTmp[0];
  const stage = apiGatewayArnTmp[1];
  const route = apiGatewayArnTmp[2];

  // Perform authorization to return the Allow policy for correct parameters and
  // the 'Unauthorized' error, otherwise.
  const authResponse = {};
  const condition: any = {};
  condition.IpAddress = {};

  if (headers['x-api-key'] === 'test-for-wes') {
    const policy = generateAllow('me', event.methodArn);
    console.log(`policy: ${JSON.stringify(policy, null, 2)}`);
    return policy;
  } else {
    return 'Unauthorized';
  }
}

// Helper function to generate an IAM policy
const generatePolicy = function (principalId: string, effect: string, resource: string) {
  // Required output:
  let authResponse: any = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument: any = {};
    policyDocument.Version = '2012-10-17'; // default version
    policyDocument.Statement = [];
    const statementOne: any = {};
    statementOne.Action = 'execute-api:Invoke'; // default action
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  // Optional output with custom properties of the String, Number or Boolean type.
  authResponse.context = {
    stringKey: 'stringval',
    numberKey: 123,
    booleanKey: true,
  };
  return authResponse;
};

const generateAllow = function (principalId: string, resource: string) {
  return generatePolicy(principalId, 'Allow', resource);
};

const generateDeny = function (principalId: string, resource: string) {
  return generatePolicy(principalId, 'Deny', resource);
};
