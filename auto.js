const readline = require('node:readline/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const data = {
68982:'Dayana Rodriguez Santos',
69036:'Nikunj Khadela',
69091:'Michael Swick',
69105:'Ayanna Navarro',
69152:'Abdulmalik Bashir',
69262:'Yair González',
69267:'Cheryl Pires',
69293:'Alex Polowick',
69334:'StClair Alcema',

};

async function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await rl.question(`${message}\n`);
  rl.close();
}

async function selectBuyerForInvoice(page, buyerName) {
  const buyerSelect = page.locator('#buyer');
  await buyerSelect.waitFor({ state: 'attached' });

  const buyerValue = await buyerSelect.evaluate((selectElement, targetName) => {
    const normalizedTargetName = targetName.trim().toLowerCase();
    const matchingOption = Array.from(selectElement.options).find((option) => {
      const optionText = (option.textContent || '').toLowerCase();
      return optionText.includes(normalizedTargetName);
    });

    return matchingOption ? matchingOption.value : null;
  }, buyerName);

  if (!buyerValue) {
    throw new Error(`Could not find buyer option for: ${buyerName}`);
  }

  const currentUrl = new URL(page.url());
  currentUrl.searchParams.set('q', '');
  currentUrl.searchParams.set('buyer', buyerValue);
  currentUrl.searchParams.set('SortOrder', '2');
  currentUrl.searchParams.set('ProductStatus', '0');
  currentUrl.searchParams.set('All', 'True');

  await page.goto(currentUrl.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
}

async function processChargeBackRows(page) {
  await page.waitForSelector('#lot-list tbody tr', { state: 'attached' });

  const rowCount = await page.locator('#lot-list tbody tr').count();
  let handledFirstRow = false;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = page.locator('#lot-list tbody tr').nth(rowIndex);
    const chargeBackButton = row.locator('.charge-back-btn');

    if ((await chargeBackButton.count()) === 0) {
      continue;
    }

    if (!(await chargeBackButton.isVisible())) {
      continue;
    }

    await chargeBackButton.scrollIntoViewIfNeeded();
    await chargeBackButton.click();

    const textarea = row.locator('.charge-back-input');
    await textarea.waitFor({ state: 'visible' });
    await textarea.fill('Unpaid');
    
    if (!handledFirstRow) {
      await textarea.press('Enter');
      await page.waitForTimeout(100);
      await textarea.click();
      await textarea.press('Enter');
      handledFirstRow = true;
    } else {
      await textarea.press('Enter');
    }

    const submitButton = page.locator('.submit-charge-back-btn').first();
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();

    const confirmButton = page.locator('#charge-back-details-ok-button');
    await confirmButton.waitFor({ state: 'visible' });
    await confirmButton.click();

    await page.waitForTimeout(400);
  }
}

async function main() {
  const userDataDir = path.join(__dirname, 'auto-chrome-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://my.hibid.com/auctioneer/lotstats/index/730693/');

  await waitForEnter('Open the target website in the browser, then press Enter here to start...');

  for (const [invoiceNumber, buyerName] of Object.entries(data)) {
    console.log(`Processing invoice ${invoiceNumber} for ${buyerName}`);
    try{
        await selectBuyerForInvoice(page, buyerName);
    } catch (error) {
        console.error(`Error processing invoice ${invoiceNumber} for ${buyerName}: ${error.message}`);
        continue;
    }
    await processChargeBackRows(page);
    await page.waitForTimeout(1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
