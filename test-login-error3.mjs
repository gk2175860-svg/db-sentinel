export default async function run(page, ui) {
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'wrongpassword');
  await page.click('button[type=submit]');
  
  // Wait a bit for React to process
  await page.waitForTimeout(2000);
  
  // Check for error element in DOM
  const errorEl = await page.$('.text-db-critical, .bg-db-critical\\/10, [class*="critical"]');
  const allDivs = await page.$$('div');
  
  // Get body text again
  const bodyText = await page.textContent('body');
  
  // Check innerHTML for error
  const html = await page.content();
  const hasErrorInHtml = html.includes('Invalid credentials') || html.includes('Invalid');
  
  return { 
    url: page.url(), 
    hasErrorElement: !!errorEl,
    hasErrorInHtml,
    bodyText: bodyText.slice(0, 500),
    htmlPreview: html.slice(0, 3000)
  };
}