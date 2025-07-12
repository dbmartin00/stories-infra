const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers'); // <-- added

const REGION = 'us-west-2';
const PROFILE = 'default'; // <-- change to your profile if needed
const TABLE_NAME = 'SLEEPERS';

const folderPath = path.join(__dirname, '../public/stories-json');

const client = new DynamoDBClient({
  region: REGION,
  credentials: fromIni({ profile: PROFILE }) // <-- explicitly load profile
});

const docClient = DynamoDBDocumentClient.from(client);

async function uploadStories() {
  console.log('uploadStories');
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const rawJson = fs.readFileSync(path.join(folderPath, file), 'utf-8');

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      console.error(`✘ Failed to parse JSON in ${file}:`, err.message);
      continue;
    }

    const match = file.match(/s-(\d+)-(\d+)\.json/);
    if (!match) {
      console.warn(`Skipping invalid filename format: ${file}`);
      continue;
    }

    const [_, chapter, page] = match;
    const section = `${chapter}-${page}`;
    const storyId = `s-${section}`;

    const item = {
      storyId,
      section,
      raw: parsed // If you prefer raw JSON string: raw: rawJson
    };

    console.log('item', item);

    try {
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));
      console.log(`✔ Uploaded ${storyId}`);
    } catch (err) {
      console.error(`✘ Failed to upload ${storyId}:`, err.message);
    }
  }
}

// Print context before running
(async () => {
  console.log(`→ Using AWS profile: ${PROFILE}`);
  console.log(`→ Region: ${REGION}`);
  try {
    const creds = await client.config.credentials();
    console.log(`→ Access key: ${creds.accessKeyId}`);
  } catch (err) {
    console.error('⚠ Unable to load AWS credentials:', err.message);
  }

  await uploadStories();
})();
