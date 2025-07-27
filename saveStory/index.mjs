import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.COGNITO_REGION;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const jwks = jwksClient({
  jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export const handler = async (event) => {
  const token = event.headers?.authorization;
  console.log('Authorization header received:', !!token);

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: No token provided' })
    };
  }

  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
          algorithms: ['RS256']
        },
        (err, decoded) => (err ? reject(err) : resolve(decoded))
      );
    });

    const groups = decoded['cognito:groups'] || [];
    console.log('Decoded email:', decoded.email);
    console.log('Groups:', groups);

    if (!groups.includes('Editors')) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden: Not in Editors group' })
      };
    }
  } catch (err) {
    console.error('❌ Token verification failed:', err.message);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid token' })
    };
  }

  // ✅ Auth passed — continue with save logic
  const query = event.queryStringParameters || {};
  const filename = query.s;

  if (!filename || !/^s-\d+-\d+\.json$/.test(filename)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid filename' })
    };
  }

  const id = filename.replace(/^s-/, '').replace(/\.json$/, '');
  const [chapter, page] = id.split('-');
  const section = `${chapter}-${page}`;
  const storyId = `s-${section}`;

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
  }

  try {
    await docClient.send(new PutCommand({
      TableName: 'TALENDARCH',
      Item: {
        storyId,
        section,
        raw: body
      }
    }));

    const targets = (body.options || []).map(opt => opt.target).filter(Boolean);

    for (const targetId of targets) {
      const targetStoryId = `s-${targetId}`;
      const result = await docClient.send(new GetCommand({
        TableName: 'TALENDARCH',
        Key: { storyId: targetStoryId }
      }));

      if (!result.Item) {
        await docClient.send(new PutCommand({
          TableName: 'TALENDARCH',
          Item: {
            storyId: targetStoryId,
            section: targetId,
            raw: {
              title: '',
              content: '',
              options: []
            }
          }
        }));
        console.log(`🧱 Created stub: s-${targetId}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('❌ Save failed:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Save failed', detail: err.message })
    };
  }
};
