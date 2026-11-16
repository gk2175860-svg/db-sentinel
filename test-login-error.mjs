export default async function run(page, ui) {
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'wrongpassword');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);
  const bodyText = await page.textContent('body');
  return { 
    url: page.url(), 
    hasError: bodyText.includes('Invalid credentials') || bodyText.includes('error') || bodyText.includes('Error'),
    bodyText: bodyText.slice(0, 500)
  };
}