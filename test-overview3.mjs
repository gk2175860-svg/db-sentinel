export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Check localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const refreshToken = await page.evaluate(() => localStorage.getItem('refreshToken'));
  
  // Wait for React to hydrate
  await page.waitForTimeout(5000);
  
  // Get the full HTML
  const html = await page.content();
  
  // Check for root element
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT';
  });
  
  return { 
    url: page.url(), 
    title: await page.title(),
    token: token ? 'SET' : 'NOT SET',
    refreshToken: refreshToken ? 'SET' : 'NOT SET',
    rootContentLength: rootContent.length,
    rootContentPreview: rootContent.slice(0, 2000),
  };
}