import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// dynamic import puppeteer when launching browser to support serverless
let puppeteer = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_TOPICS = [
  'feed',
  'bangladeshibusiness',
  'entrepreneurship',
  'startupbangladesh',
  'smallbusiness',
  'technology',
  'feed'
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
    userDataDir: path.join(__dirname, '..', 'fb_cloud_profile'),
    defaultViewport: { width: 1280, height: 850 },
    args
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return await puppeteer.launch(launchOptions);
}

export function loadFacebookSession() {
  if (process.env.FACEBOOK_COOKIES_JSON) {
    try {
      return JSON.parse(process.env.FACEBOOK_COOKIES_JSON);
    } catch (e) {
      console.error('[FB-Cloud] Failed to parse FACEBOOK_COOKIES_JSON from env:', e.message);
    }
  }
  const localFile = path.join(__dirname, 'facebook_session.json');
  if (fs.existsSync(localFile)) {
    try {
      return JSON.parse(fs.readFileSync(localFile, 'utf8'));
    } catch (e) {}
  }
  return null;
}

export async function injectSessionCookies(page, session) {
  if (!session) return false;
  if (session.cookies && Array.isArray(session.cookies)) {
    for (const c of session.cookies) {
      try {
        await page.setCookie({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          httpOnly: c.httpOnly,
          secure: c.secure
        });
      } catch (e) {}
    }
  }
  if (session.c_user) {
    try {
      await page.setCookie({
        name: 'c_user',
        value: session.c_user,
        domain: '.facebook.com',
        path: '/',
        httpOnly: false,
        secure: true
      });
    } catch (e) {}
  }
  if (session.xs) {
    try {
      await page.setCookie({
        name: 'xs',
        value: session.xs,
        domain: '.facebook.com',
        path: '/',
        httpOnly: true,
        secure: true
      });
    } catch (e) {}
  }
  return true;
}

export async function verifyFacebookCloudSession() {
  const session = loadFacebookSession();
  if (!session) return { loggedIn: false, error: 'No session cookies found' };

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await injectSessionCookies(page, session);

    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    const url = page.url();
    const isLogin = url.includes('/login') || (await page.$('input[name="email"]')) !== null;
    const hasProfileBtn = (await page.$('[aria-label*="Your profile"], [aria-label*="Profile"], [aria-label*="আপনার প্রোফাইল"], [aria-label*="প্রোফাইল"]')) !== null;
    const hasFeed = (await page.$('[role="feed"]')) !== null;
    const isLoggedIn = !isLogin && (hasProfileBtn || hasFeed || !url.includes('/login'));

    return { loggedIn: isLoggedIn, url };
  } catch (err) {
    return { loggedIn: false, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

export async function runFacebookCloudCycle({ maxLikes = 5 } = {}) {
  const session = loadFacebookSession();
  if (!session) {
    return { status: 'error', message: 'No session cookies found in FACEBOOK_COOKIES_JSON' };
  }

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await injectSessionCookies(page, session);

    const topic = TARGET_TOPICS[Math.floor(Math.random() * TARGET_TOPICS.length)];
    const targetUrl = topic === 'feed'
      ? 'https://www.facebook.com/'
      : `https://www.facebook.com/hashtag/${topic}/`;

    console.log(`[FB-Cloud] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 4000));

    // Handle Profile Switcher if shown
    try {
      const continueBtn = await page.$('div[aria-label*="Continue"], div[role="button"][aria-label*="চালিয়ে যান"]');
      if (continueBtn) {
        await continueBtn.click();
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (e) {}

    const url = page.url();
    if (url.includes('/login')) {
      return { status: 'needs_login', message: 'Session expired or invalidated by Meta' };
    }

    let likesDone = 0;
    for (let scrollCycle = 0; scrollCycle < 4 && likesDone < maxLikes; scrollCycle++) {
      const newLikes = await page.evaluate((maxRemaining) => {
        const units = Array.from(document.querySelectorAll('div[data-pagelet*="FeedUnit"], div[role="feed"] > div, div[role="article"]'));
        let clicked = 0;

        for (const u of units) {
          if (clicked >= maxRemaining) break;
          const likeBtn = u.querySelector('div[aria-label="Like"], div[aria-label="লাইক"], div[role="button"][aria-label*="Like"], div[role="button"][aria-label*="লাইক"]');
          if (likeBtn) {
            const isLiked = likeBtn.getAttribute('aria-pressed') === 'true' ||
                            likeBtn.innerText.includes('Liked') ||
                            likeBtn.innerText.includes('লাইক দিয়েছেন');
            if (!isLiked) {
              likeBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
              likeBtn.click();
              clicked++;
            }
          }
        }
        return clicked;
      }, maxLikes - likesDone);

      likesDone += newLikes;
      await page.evaluate(() => window.scrollBy(0, 700 + Math.floor(Math.random() * 400)));
      await new Promise(r => setTimeout(r, 4000 + Math.floor(Math.random() * 3000)));
    }

    const proofPath = path.join(__dirname, '..', 'public', 'latest_fb_action.png');
    await page.screenshot({ path: proofPath });

    return {
      status: 'success',
      topic,
      likesDone,
      proofPath
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

export async function publishFacebookPostCloud(caption, imagePath = null) {
  const session = loadFacebookSession();
  if (!session) {
    return { status: 'error', message: 'No session cookies found' };
  }

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    await injectSessionCookies(page, session);

    console.log('[FB-Cloud] Navigating to Facebook home...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await new Promise(r => setTimeout(r, 4000));

    // Look for post creator trigger
    const postBoxSelectors = [
      'div[role="button"][aria-label*="What\'s on your mind"]',
      'div[role="button"][aria-label*="আপনার মনে কি"]',
      'div[role="button"][aria-label*="Create a post"]',
      'div[role="region"] div[role="button"] span'
    ];

    let clicked = false;
    for (const sel of postBoxSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          clicked = true;
          break;
        }
      } catch (e) {}
    }

    if (!clicked) {
      await page.keyboard.press('p');
      await new Promise(r => setTimeout(r, 2000));
    }

    await new Promise(r => setTimeout(r, 2500));
    const editorSelector = 'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"]';
    await page.waitForSelector(editorSelector, { timeout: 15000 });

    const editor = await page.$(editorSelector);
    await editor.focus();

    for (const char of caption) {
      await page.keyboard.type(char, { delay: Math.floor(15 + Math.random() * 25) });
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const fileInputs = await page.$$('input[type="file"][accept*="image"]');
      if (fileInputs.length > 0) {
        await fileInputs[0].uploadFile(imagePath);
        await new Promise(r => setTimeout(r, 4000));
      }
    }

    await new Promise(r => setTimeout(r, 2000));
    const postButtonSelectors = [
      'div[aria-label="Post"][role="button"]',
      'div[aria-label="পোস্ট করুন"][role="button"]',
      'div[aria-label="পোস্ট"][role="button"]',
      'form div[role="button"]:not([aria-disabled="true"]) span'
    ];

    let posted = false;
    for (const pSel of postButtonSelectors) {
      try {
        const btn = await page.$(pSel);
        if (btn) {
          await btn.click();
          posted = true;
          break;
        }
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, 6000));
    const proofPath = path.join(__dirname, '..', 'public', 'latest_fb_post.png');
    await page.screenshot({ path: proofPath });

    return {
      status: posted ? 'success' : 'submitted',
      caption,
      proofPath
    };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

