export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Wait for React to hydrate and queries to complete
  await page.waitForTimeout(8000);
  
  // Get console messages
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  
  // Check for network errors
  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
  
  // Get the root element content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT';
  });
  
  // Check for specific elements
  const overviewTitle = await page.$('h1:has-text("Overview")');
  const kpiCards = await page.$$('.grid > div');
  
  return { 
    url: page.url(), 
    title: await page.title(),
    rootContentLength: rootContent.length,
    rootContentPreview: rootContent.slice(0, 3000),
    consoleLogs: logs.slice(-30),
    failedRequests: failedRequests.slice(-10),
    hasOverviewTitle: !!overviewTitle,
    kpiCardsCount: kpiCards.length
  };
}