import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// dynamic import puppeteer
let puppeteer = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_HASHTAGS = [
  'bangladeshbusiness',
  'smebangladesh',
  'bdentrepreneur',
  'dhakafashion',
  'bangladeshistartup',
  'bdclothing',
  'dhakabusiness',
  'bangladeshi',
  'accountingbangladesh'
];

export async function launchBrowser() {
  if (!puppeteer) {
    try {
      puppeteer = (await import('puppeteer')).default;
    } catch (e) {
      throw new Error('Puppeteer browser is only available on container/local environment, not in serverless.');
    }
  }
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--headless=new',
    '--disable-notifications'
  ];

  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    if (process.platform === 'linux') {
      if (fs.existsSync('/usr/bin/google-chrome-stable')) executablePath = '/usr/bin/google-chrome-stable';
      else if (fs.existsSync('/usr/bin/chromium')) executablePath = '/usr/bin/chromium';
      else if (fs.existsSync('/usr/bin/chromium-browser')) executablePath = '/usr/bin/chromium-browser';
    } else if (process.platform === 'win32') {
      const brave = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
      const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      if (fs.existsSync(brave)) executablePath = brave;
      else if (fs.existsSync(chrome)) executablePath = chrome;
    }
  }

  const launchOptions = {
    headless: 'new',
    userDataDir: path.join(__dirname, '..', 'ig_cloud_profile'),
    defaultViewport: { width: 1280, height: 850 },
    args
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return await puppeteer.launch(launchOptions);
}

export function loadInstagramSession() {
  let sessionid = process.env.INSTAGRAM_SESSION_ID || '';
  let dsUserId = process.env.INSTAGRAM_USER_ID || '64300924631';

  const sessFile = path.join(__dirname, 'instagram_session.json');
  if (fs.existsSync(sessFile)) {
    try {
      const s = JSON.parse(fs.readFileSync(sessFile, 'utf8'));
      if (!sessionid && s.sessionid) sessionid = s.sessionid;
      if (!dsUserId && s.ds_user_id) dsUserId = s.ds_user_id;
    } catch (e) {}
  }
  return { sessionid, dsUserId };
}

export async function injectInstagramCookies(page, session) {
  if (session && session.sessionid) {
    await page.setCookie(
      {
        name: 'sessionid',
        value: session.sessionid,
        domain: '.instagram.com',
        path: '/',
        httpOnly: true,
        secure: true
      },
      {
        name: 'ds_user_id',
        value: session.dsUserId || '64300924631',
        domain: '.instagram.com',
        path: '/',
        secure: true
      }
    );
    return true;
  }
  return false;
}

export async function verifyInstagramCloudSession() {
  const session = loadInstagramSession();
  if (!session.sessionid) return { loggedIn: false, error: 'No sessionid found' };

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await injectInstagramCookies(page, session);

    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const url = page.url();
    const isLogin = url.includes('/accounts/login');
    return { loggedIn: !isLogin, url };
  } catch (err) {
    return { loggedIn: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

export async function runInstagramCloudCycle({ maxLikes = 6 } = {}) {
  const session = loadInstagramSession();
  if (!session.sessionid) {
    return { status: 'error', message: 'Instagram sessionid missing' };
  }

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await injectInstagramCookies(page, session);

    const tag = TARGET_HASHTAGS[Math.floor(Math.random() * TARGET_HASHTAGS.length)];
    const tagUrl = `https://www.instagram.com/explore/tags/${tag}/`;
    console.log(`[IG-Cloud] Exploring hashtag: #${tag}`);

    await page.goto(tagUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 4000));

    const url = page.url();
    if (url.includes('/accounts/login')) {
      return { status: 'needs_login', message: 'Instagram session expired' };
    }

    // Scroll to discover posts
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise(r => setTimeout(r, 3000));

    // Discover post links
    const postUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'));
      return Array.from(new Set(anchors.map(a => a.href))).slice(0, 10);
    });

    let likesDone = 0;
    for (const pUrl of postUrls) {
      if (likesDone >= maxLikes) break;
      try {
        await page.goto(pUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise(r => setTimeout(r, 3000));

        const liked = await page.evaluate(() => {
          const heartIcons = Array.from(document.querySelectorAll('svg[aria-label="Like"], svg[aria-label="লাইক"]'));
          for (const h of heartIcons) {
            const btn = h.closest('button') || h.closest('div[role="button"]');
            if (btn) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (liked) {
          likesDone++;
          console.log(`[IG-Cloud] Liked post ${likesDone}/${maxLikes}: ${pUrl}`);
          await new Promise(r => setTimeout(r, 3000 + Math.floor(Math.random() * 2000)));
        }
      } catch (e) {
        console.warn('[IG-Cloud] Error on post:', e.message);
      }
    }

    const proofPath = path.join(__dirname, '..', 'public', 'latest_ig_action.png');
    await page.screenshot({ path: proofPath });

    return {
      status: 'success',
      tag,
      likesDone,
      proofPath
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}
