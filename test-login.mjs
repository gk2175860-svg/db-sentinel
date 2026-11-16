export default async function run(page, ui) {
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);
  return { url: page.url(), title: await page.title() };
}