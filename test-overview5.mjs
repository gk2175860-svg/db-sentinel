export default async function run(page, ui) {
  // First login
  await page.fill('input[type=email]', 'admin@db-sentinel.io');
  await page.fill('input[type=password]', 'admin123');
  await page.click('button[type=submit]');
  await page.waitForURL('**/overview', { timeout: 10000 });
  
  // Get token from localStorage
  const token = await page.evaluate(() => localStorage.getItem('token'));
  
  // Test /auth/me directly with the token
  const authMeResult = await page.evaluate(async (t) => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      return { status: res.status, data: await res.json() };
    } catch (e) {
      return { error: e.message };
    }
  }, token);
  
  // Test /databases directly with the token
  const databasesResult = await page.evaluate(async (t) => {
    try {
      const res = await fetch('/api/v1/databases', {
        headers: { 'Authorization': `Bearer ${t}` }
      });
      return { status: res.status, data: await res.json() };
    } catch (e) {
      return { error: e.message };
    }
  }, token);
  
  // Wait a bit more
  await page.waitForTimeout(5000);
  
  // Get the root element content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML : 'NO ROOT';
  });
  
  return { 
    url: page.url(), 
    title: await page.title(),
    token: token ? 'SET' : 'NOT SET',
    authMeResult,
    databasesResult,
    rootContentLength: rootContent.length,
    rootContentPreview: rootContent.slice(0, 3000),
  };
}