const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = '/home/sourabh_kumar04_ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Simple static server for dist
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url.split('?')[0]);
  if (filePath.endsWith('/') || !path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(fallback, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

async function run() {
  const port = 4199;
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`Static server running on port ${port}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

    // 1. Desktop Survey view (Hero + Stat Band + Section Bands + Recorder)
    console.log('Navigating to Survey view...');
    await page.goto(`http://localhost:${port}/?tab=identify`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '11_bow_hero_survey_desktop.png'),
      fullPage: false,
    });
    console.log('Captured: 11_bow_hero_survey_desktop.png');

    // Full page desktop
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '12_bow_full_page_desktop.png'),
      fullPage: true,
    });
    console.log('Captured: 12_bow_full_page_desktop.png');

    // 2. Demo Predictions Species Card
    console.log('Navigating to Prediction demo...');
    await page.goto(`http://localhost:${port}/?demo=prediction`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '13_bow_prediction_species_cards.png'),
      fullPage: true,
    });
    console.log('Captured: 13_bow_prediction_species_cards.png');

    // 3. Journal Tab with species cards & warm off-white bands
    console.log('Navigating to Journal tab...');
    await page.goto(`http://localhost:${port}/?tab=journal&demo=populated`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '14_bow_journal_species_cards.png'),
      fullPage: true,
    });
    console.log('Captured: 14_bow_journal_species_cards.png');

    // 4. Mobile Viewport (iPhone 14 style: 390x844)
    console.log('Capturing mobile view...');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await page.goto(`http://localhost:${port}/?tab=identify`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '15_bow_mobile_survey.png'),
      fullPage: true,
    });
    console.log('Captured: 15_bow_mobile_survey.png');

    // 5. Species Tab with the 4 demo species as proper species cards
    console.log('Capturing Species Catalog Tab...');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(`http://localhost:${port}/?tab=species`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '16_bow_species_catalog_demo_cards.png'),
      fullPage: true,
    });
    console.log('Captured: 16_bow_species_catalog_demo_cards.png');

    // 6. Discreet Testing Toggle at very bottom (collapsed and expanded)
    console.log('Capturing Discreet Testing Toggle...');
    await page.goto(`http://localhost:${port}/?tab=identify`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '17_bow_testing_toggle_collapsed.png'),
      fullPage: false,
    });

    // Click toggle to expand
    const toggleBtn = await page.$('button[aria-expanded]');
    if (toggleBtn) {
      await toggleBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '18_bow_testing_toggle_expanded.png'),
        fullPage: false,
      });
      console.log('Captured: 17 & 18 testing toggle screenshots');
    }

    // 7. Verify Initial First Paint with JavaScript Disabled (to verify dark-brown header/hero/stat band paints first without light flash)
    console.log('Capturing Initial Paint with JS Disabled...');
    await page.setJavaScriptEnabled(false);
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '19_bow_initial_paint_no_flash.png'),
      fullPage: false,
    });
    await page.setJavaScriptEnabled(true);
    console.log('Captured: 19_bow_initial_paint_no_flash.png');

    console.log('All screenshots captured successfully!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  server.close();
  process.exit(1);
});
