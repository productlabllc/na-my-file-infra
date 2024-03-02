import { PrismaClient } from '@prisma/client';

let db: PrismaClient;
const { DB_CREDS, NODE_ENV = 'dev' } = process.env;

const getConnectionString = () => {
  if (!DB_CREDS) {
    throw new Error('DB_CREDS environment variable must be set.');
  }
  const { connectionString } = JSON.parse(DB_CREDS);
  // const connectionString = `postgresql://${username}:${password}@${host}:${port}/${dbname}`;
  return connectionString;
};

export const getDB = () => {
  if (db) {
    return db;
  }
  try {
    db = new PrismaClient({
      datasources: { db: { url: getConnectionString() } },
      log:
        NODE_ENV === 'prod'
          ? ['error']
          : [
              {
                emit: 'event',
                level: 'query',
              },
              {
                emit: 'stdout',
                level: 'error',
              },
              {
                emit: 'stdout',
                level: 'info',
              },
              {
                emit: 'stdout',
                level: 'warn',
              },
            ],
    });
    // @ts-ignore
    db.$on('query', (e) => {
      console.log('Query: ' + e.query);
      console.log('Params: ' + e.params);
      console.log('Duration: ' + e.duration + 'ms');
    });
  } catch (err) {
    throw err;
    // db = new PrismaClient({
    //   // log: ['query', 'info', 'warn', 'error'],
    // });
  }

  return db;
};

// const addExtensions = (prisma: PrismaClient) => {
//   prisma.$extends({
//     result: {
//       dailyClaims: {

//       },
//       user: {
//         fullName: {
//           needs: { GivenName: true, FamilyName: true },
//           compute(user) {
//             return `${user.GivenName} ${user.FamilyName}`
//           },
//         },
//       },
//     },
//   })
// };
