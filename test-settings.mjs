export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Wait for overview to load
  await page.waitForTimeout(3000);
  
  // Navigate to settings page
  await page.goto('http://localhost:5173/settings');
  await page.waitForTimeout(3000);
  
  // Check for errors
  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  
  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
  
  // Get page content
  const bodyText = await page.textContent('body');
  
  return { 
    url: page.url(), 
    title: await page.title(),
    bodyText: bodyText ? bodyText.slice(0, 500) : 'EMPTY',
    consoleLogs: logs.slice(-20),
    failedRequests: failedRequests.slice(-10)
  };
}