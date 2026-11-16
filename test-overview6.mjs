export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Wait
  await page.waitForTimeout(5000);
  
  // Check for specific elements in the DOM
  const hasSpinner = await page.$('.animate-spin');
  const hasLayout = await page.$('[class*="min-h-screen"]');
  const hasSidebar = await page.$('aside');
  const hasMain = await page.$('main');
  const hasOverviewTitle = await page.$('h1:has-text("Overview")');
  const hasDevtools = await page.$('.tsqd-parent-container');
  
  // Get all div elements at root level
  const rootDivs = await page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return 'NO ROOT';
    return Array.from(root.children).map(el => ({
      tag: el.tagName,
      class: el.className,
      id: el.id
    }));
  });
  
  return { 
    url: page.url(), 
    title: await page.title(),
    hasSpinner: !!hasSpinner,
    hasLayout: !!hasLayout,
    hasSidebar: !!hasSidebar,
    hasMain: !!hasMain,
    hasOverviewTitle: !!hasOverviewTitle,
    hasDevtools: !!hasDevtools,
    rootDivs
  };
}