export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Wait for React to hydrate
  await page.waitForTimeout(5000);
  
  // Get console messages
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  
  // Check for network errors
  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
  
  // Get the full HTML
  const html = await page.content();
  
  return { 
    url: page.url(), 
    title: await page.title(),
    htmlLength: html.length,
    htmlPreview: html.slice(0, 2000),
    consoleLogs: logs.slice(-20),
    failedRequests: failedRequests.slice(-10)
  };
}