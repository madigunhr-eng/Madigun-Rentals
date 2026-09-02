import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DIST_PATH = path.join(__dirname, 'dist');
const INDEX_HTML_PATH = path.join(DIST_PATH, 'index.html');

// Helper to serve a high-quality, friendly troubleshooting page if the build is missing
function serveTroubleshootingPage(res, reason) {
  res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup Required — Madigun Inventory</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0a09;
      color: #f5f5f4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background-color: #1c1917;
      border: 1px solid #44403c;
      border-radius: 12px;
      padding: 36px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
      color: #fafaf9;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    p {
      color: #a8a29e;
      line-height: 1.6;
      font-size: 15px;
      margin-bottom: 20px;
    }
    .code-container {
      margin: 16px 0;
    }
    .label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #78716c;
      margin-bottom: 6px;
    }
    .code-block {
      background-color: #0c0a09;
      border: 1px solid #2e2a24;
      border-radius: 8px;
      padding: 14px 18px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13.5px;
      color: #34d399;
      overflow-x: auto;
      margin: 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: #e7e5e4;
      color: #1c1917;
      text-decoration: none;
      padding: 11px 20px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      transition: background-color 0.15s ease;
      cursor: pointer;
      border: none;
    }
    .btn:hover {
      background-color: #f5f5f4;
    }
    .badge {
      background-color: #f59e0b;
      color: #0c0a09;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: inline-block;
      margin-bottom: 16px;
    }
    .step-number {
      background-color: #44403c;
      color: #fafaf9;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Action Required</div>
    <h1>Production Build Needed</h1>
    <p>The PM2 background manager is running, but the compiled frontend files are missing.</p>
    
    <div class="code-container">
      <div class="label"><span class="step-number">1</span> Run the Build Command</div>
      <pre class="code-block">npm run build</pre>
    </div>

    <div class="code-container">
      <div class="label"><span class="step-number">2</span> Restart the PM2 Process</div>
      <pre class="code-block">pm2 restart madigun-inventory</pre>
    </div>

    <p style="margin-top: 28px; font-size: 13px; color: #78716c;">
      Reason: ${reason}
    </p>

    <div style="margin-top: 24px;">
      <button onclick="window.location.reload()" class="btn">Refresh Page</button>
    </div>
  </div>
</body>
</html>
  `);
}

// Serve static assets dynamically using express.static
// Since express.static looks up files in DIST_PATH on every request, it works even if files are added later.
app.use(express.static(DIST_PATH, {
  maxAge: '1y',
  etag: true
}));

// Route everything else to the index.html or troubleshooting page dynamically
app.get('*', (req, res) => {
  if (fs.existsSync(DIST_PATH) && fs.existsSync(INDEX_HTML_PATH)) {
    res.sendFile(INDEX_HTML_PATH);
  } else {
    const reason = !fs.existsSync(DIST_PATH) 
      ? "The 'dist' directory does not exist." 
      : "The 'dist/index.html' file is missing.";
    serveTroubleshootingPage(res, reason);
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Madigun Inventory server running on http://localhost:${PORT}`);
});
