import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const baseClient = new DynamoDBClient({ region: 'us-west-2' });
const docClient = DynamoDBDocumentClient.from(baseClient);

export const handler = async (event) => {
  console.log('readAllStories');

  const defaultTable = 'TALENDARCH';
  const table = event?.queryStringParameters?.table || defaultTable;
  console.log(`📚 Using table: ${table}`);

  try {
    console.log('🔍 Scanning stories table...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let data;
    try {
      data = await docClient.send(
        new ScanCommand({ TableName: table }),
        { abortSignal: controller.signal }
      );
      clearTimeout(timeout);
    } catch (scanErr) {
      clearTimeout(timeout);
      console.error('❌ Scan failed or timed out:', scanErr.name, scanErr.message);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Scan failed', detail: scanErr.message }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const items = (data.Items || []).map(item => ({
      id: item.section,
      ...item.raw
    }));

    console.log(`✔ Found ${items.length} stories`);
    items.forEach((item, i) => {
      if (i < 5) {
        console.log(`Item ${i}:`, JSON.stringify(item, null, 2));
      }
    });
    if (items.length > 5) {
      console.log(`...and ${items.length - 5} more`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(items),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (err) {
    console.error('❌ Unexpected failure:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected error', detail: err.message }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
