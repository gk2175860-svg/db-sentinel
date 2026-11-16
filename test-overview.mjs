export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  // Check for the overview page content
  const content = await page.textContent('body');
  const hasOverview = content.includes('Overview');
  const hasKPI = content.includes('Connected Databases');
  
  return { 
    url: page.url(), 
    title: await page.title(),
    hasOverview,
    hasKPI,
    contentLength: content.length,
    contentPreview: content.slice(0, 500)
  };
}