import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
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

    // Create stub stories for missing targets
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
