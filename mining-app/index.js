
import express from 'express';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import Account from './db/account.js';

const app = express();

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const port = 5000;
const viewPath = `${process.cwd()}/views/`;
const browsers = {};
const executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Helper
async function excute(account) {
  const userDataDir = path.join(`${process.cwd()}/browser/`, `profile_${account.id}`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir);
  }

  // Clear old browser
  const accountBrowser = browsers[account.id] ?? null;
  if (accountBrowser) {
    await accountBrowser.close();
    browsers[account.id] = null;
  }

  let interval = null;
  let interval2 = null;
  let interval3 = null;

  const manualClearInterval = () => {
    if (interval) {
      clearInterval(interval)
      interval = null;
    }

    if (interval2) {
      clearInterval(interval2)
      interval2 = null;
    }

    if (interval3) {
      clearInterval(interval3)
      interval3 = null;
    }
  }

  try {
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir,
      executablePath,
      args: [
        '--no-sandbox',
        '--mute-audio',
        '--disable-gpu'
      ],
    });
    const contextId = browser.process().pid
  
    console.log(`IDE [${account.id}] is online - Starting...`);
  
    // Create page
    const page = await browser.newPage();
  
    // Remove process
    browser.on('disconnected', async () => {
      console.log('Browser disconnected!');
      if (interval) {
        clearInterval(interval)
        interval = null;
      }
      await Account.update({ context_id: null, status: 0 }, { id: account.id });
    });
  
    try {
      await page.setViewport({
        width: 1200, // Set your desired width
        height: 600, // Set your desired height
        deviceScaleFactor: 1,
      });
  
      // Update account status
      await Account.update({ context_id: contextId, status: 1 }, { id: account.id });
  
      // Navigate to the login page
      page.on('dialog', async (dialog) => {
        console.log(`Dialog message: ${dialog.message()}`);
        // Ignore the dialog by accepting it
        await dialog.accept();
      });  
      await page.goto(account.url);
  
      // Implement your login logic based on the structure of the login page
      const login = async () => {
        const isLogin = await page.$('input[name="name"]');
        if (isLogin !== null) {
          await page.type('input[name="name"]', account.email);
          await page.type('input[name="pass"]', account.password);
          await page.click('button#edit-submit');
          await page.waitForNavigation();
        }
      }
      await login();
  
      // Reload page
      const reload = async () => {
        console.log(`IDE [${account.id}] is offline - Reloading...`);
        await page.reload();
        await page.waitForNavigation();
        await login();
        await Account.update({ status: 1 }, { id: account.id });
      }
  
      // store browsers
      browsers[account.id] = { browser, reload };
  
      // check page offline
      interval = setInterval(async () => {
        const offline = await page.evaluate(() => {
          let msg = document.querySelector('div#status-bar-connection-status')?.textContent?.toLowerCase() ?? '';
          let reloadbutton = document.querySelectorAll('div.theia-button[data-action="Reload"]').length;
          return msg === 'offline' || reloadbutton > 0;
        });

        if (offline) {
          await Account.update({ status: 0 }, { id: account.id });
          reload();
        }
      }, 15000);

      // Check login page
      interval2 = setInterval(async () => {
        const currentURL = await page.url();
        if (currentURL.startsWith('https://accounts.acquia.com/sign-in')) {
          login();
        }
      }, 15000);
      
      // Check offline
      interval3 = setInterval(async () => {
        const offline = await page.evaluate(() => {
          let msg = document.querySelector('div#status-bar-connection-status')?.textContent?.toLowerCase() ?? '';
          let reloadbutton = document.querySelectorAll('div.theia-button[data-action="Reload"]').length;
          return msg === 'offline' || reloadbutton > 0;
        });
  
        if (offline) {
          await Account.update({ status: 0 }, { id: account.id });
          reload();
        }
      }, 15000);
    } catch (error) {
      manualClearInterval();
      await browser.close();
      await Account.update({ context_id: null, status: 0 }, { id: account.id });
    }
  } catch (error) {
    const br = browsers[account.id] ?? null;
    if(br) {
      await br.close();
      browsers[account.id] = null;
    }

    manualClearInterval();
    await Account.update({ context_id: null, status: 0 }, { id: account.id });
  }
}

// App Router
app.get('/', function (req, res) {
  res.sendFile(path.join(viewPath, '/index.html'));
});

app.get('/api/v1/accounts', async (req, res) => {
  const accounts = await Account.all();
  res.json(accounts);
});

app.get('/api/v1/accounts/:id', async (req, res) => {
  const id = req.params.id;
  const account = await Account.findById(id);

  if (!account) {
    res.status(404).json({ status: false, message: `Browser [${browserId}] is not found!` });
    return;
  }

  res.json({ status: true, data: account });
});

app.post('/api/v1/accounts/create', async (req, res) => {
  const body = req.body;

  body.status = 0;
  body.context_id = null;
  body.password = 'Changeme2023..';

  await Account.create(body);

  res.json({ status: true, message: `Browser [${body.id}] is saved!` });
});

app.post('/api/v1/accounts/start/:id', async (req, res) => {
  const browserId = req.params.id;
  const account = await Account.findById(browserId);

  if (!account) {
    res.status(404).json({ status: false, message: `Browser [${browserId}] is not started!` });
  }

  excute(account);

  res.json({ status: true, message: `Browser [${browserId}] is starting!` });
});

app.post('/api/v1/accounts/reload/:id', async (req, res) => {
  const browserId = req.params.id;
  const account = await Account.findById(browserId);

  if (!account) {
    res.status(404).json({ status: false, message: `Browser [${browserId}] is not started!` });
  }

  const browser = browserId[account.id] ?? null;

  if (!browser) {
    res.status(404).json({ status: false, message: `Browser [${browserId}] is not started!` });
    return;
  }

  browser.reload();

  res.json({ status: true, message: `Browser [${browserId}] is reloaded!` });
});

app.post('/api/v1/accounts/start', async (req, res) => {
  const accounts = await Account.all();

  for (const account of accounts) {
    excute(account);
  }

  res.json({ status: true });
});

app.listen(port);
console.log('Server started at http://localhost:' + port);