// HTML → PDF via headless Chromium.
// On Vercel/Lambda uses @sparticuz/chromium; locally uses an installed Chrome
// (set CHROME_PATH, or rely on the common Windows/macOS/Linux locations).

const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean) as string[];

async function firstExisting(paths: string[]): Promise<string | undefined> {
  const fs = await import('node:fs');
  return paths.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const puppeteer = await import('puppeteer-core');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    const executablePath = await firstExisting(LOCAL_CHROME);
    if (!executablePath) {
      throw new Error('Chrome introuvable en local — définir CHROME_PATH dans .env.local');
    }
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
