const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5001;
const STORIES_DIR = path.join(__dirname, 'public', 'stories-json');

app.use(cors());
app.use(express.json());

if (!fs.existsSync(STORIES_DIR)) {
  fs.mkdirSync(STORIES_DIR, { recursive: true });
}

let storyCache = {};

function loadAllStories() {
  storyCache = {};
  const files = fs.readdirSync(STORIES_DIR);
  files.forEach((file) => {
    if (/^s-\d+-\d+\.json$/.test(file)) {
      const id = file.replace(/^s-/, '').replace(/\.json$/, '');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(STORIES_DIR, file), 'utf-8'));
        storyCache[id] = data;
      } catch (err) {
        console.warn(`⚠️ Failed to parse ${file}: ${err.message}`);
      }
    }
  });
}

loadAllStories();

app.get('/read-all', (req, res) => {
  res.json(Object.entries(storyCache).map(([id, data]) => ({
    id,
    ...data,
  })));
});

app.post('/save-story', (req, res) => {
  const filename = req.query.s;
  if (!filename || !filename.match(/^s-\d+-\d+\.json$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(STORIES_DIR, filename);
  const id = filename.replace(/^s-/, '').replace(/\.json$/, '');
  const body = req.body;

  fs.writeFile(filePath, JSON.stringify(body, null, 2), (err) => {
    if (err) {
      console.error('❌ Failed to save:', err);
      return res.status(500).json({ error: 'Save failed' });
    }

    storyCache[id] = body;

    // ✅ Auto-create stub files for options
    const targets = (body.options || []).map(opt => opt.target).filter(Boolean);

    for (const targetId of targets) {
      const stubFile = `s-${targetId}.json`;
      const stubPath = path.join(STORIES_DIR, stubFile);

      if (!fs.existsSync(stubPath)) {
        const stubData = {
          title: '',
          content: '',
          options: [],
        };

        fs.writeFileSync(stubPath, JSON.stringify(stubData, null, 2));
        storyCache[targetId] = stubData;
        console.log(`🧱 Created stub: ${stubFile}`);
      }
    }

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);
});

