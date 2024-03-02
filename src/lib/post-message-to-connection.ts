import httpsPromise from './http-promise';
import aws4 from 'aws4';
import { IncomingMessage } from 'http';
import { URL } from 'url';

type MethodParams = {
  connectionId: string;
  message: string;
  apiUrl: URL;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  contentType?: string;
};

export default async ({
  connectionId,
  message,
  apiUrl,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  region,
  contentType,
}: MethodParams) => {
  const apiHostname = apiUrl.hostname;
  const apiEndpointBase = `${apiUrl.protocol}//${apiUrl.hostname}`;
  const apiEndpointPath = apiUrl.pathname;
  const apiEndpoint = `${apiEndpointBase}${apiEndpointPath}`;
  console.log(`api endpoint: ${apiEndpoint}`);
  const opts = {
    host: apiHostname,
    path: apiEndpointPath,
    service: 'execute-api',
    region,
    body: message,
    method: 'POST',
    headers: {
      'Content-Type': contentType || 'text/plain',
    },
  };
  aws4.sign(opts, { accessKeyId, secretAccessKey, sessionToken });

  let response: any = '';
  try {
    console.log(`https request options:
    ${JSON.stringify(opts, null, 2)}
    `);
    response = await httpsPromise(opts, message);
  } catch (err) {
    console.log(JSON.stringify(err, null, 2));
  }
  return response;
};
