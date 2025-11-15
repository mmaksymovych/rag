import express from 'express';
import * as path from 'path';
import * as fs from 'fs';

const app = express();
const PORT = 3001;

// Serve static HTML files from articles directory
app.get('/article/vulnerability', (req, res) => {
  const articlePath = path.join(__dirname, 'articles', 'vulnerability-article.html');
  
  if (fs.existsSync(articlePath)) {
    const html = fs.readFileSync(articlePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } else {
    res.status(404).send('Article not found');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'test-forum' });
});

app.listen(PORT, () => {
  console.log(`Test forum server running on http://localhost:${PORT}`);
  console.log(`Article available at: http://localhost:${PORT}/article/vulnerability`);
});

