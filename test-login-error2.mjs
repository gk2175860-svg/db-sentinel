export default async function run(page, ui) {
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'wrongpassword');
  await page.click('button[type=submit]');
  
  // Wait for error to appear
  try {
    await page.waitForSelector('.text-db-critical, .bg-db-critical\\/10', { timeout: 5000 });
  } catch (e) {
    // Ignore timeout
  }
  
  await page.waitForTimeout(1000);
  const bodyText = await page.textContent('body');
  return { 
    url: page.url(), 
    hasError: bodyText.includes('Invalid credentials') || bodyText.includes('error') || bodyText.includes('Error'),
    bodyText: bodyText.slice(0, 500)
  };
}