const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers');

const REGION = 'us-west-2';
const PROFILE = 'default';
const TABLE_NAME = 'TALENDARCH';

const client = new DynamoDBClient({
  region: REGION,
  credentials: fromIni({ profile: PROFILE })
});
const docClient = DynamoDBDocumentClient.from(client);

async function scanTable() {
  let items = [];
  let ExclusiveStartKey;

  do {
    const params = {
      TableName: TABLE_NAME,
      ExclusiveStartKey
    };

    try {
      const data = await docClient.send(new ScanCommand(params));
      items.push(...data.Items);
      ExclusiveStartKey = data.LastEvaluatedKey;
    } catch (err) {
      console.error('Error scanning table:', err.message);
      return;
    }
  } while (ExclusiveStartKey);

  console.log(`Found ${items.length} item(s):`);
  for (const item of items) {
    console.log(JSON.stringify(item, null, 2));
  }
}

scanTable();

