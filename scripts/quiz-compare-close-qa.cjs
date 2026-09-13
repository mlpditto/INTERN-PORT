const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage();
  const html = fs.readFileSync('public/admin.html','utf8').replace(/\r\n/g,'\n');
  const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).join('');
  const modal = html.slice(html.indexOf('<div id="quizCompareModal"'), html.indexOf('<div id="quizCompareModal"')+4000);
  await page.setContent(styles + modal.slice(0, modal.indexOf('</div>\n    </div>')+18));
  await page.addScriptTag({content:html.slice(html.indexOf('function forceShowModal('),html.indexOf('window.selectAiToolbarToggle'))});
  for (const key of [null,'Enter',' ']) {
   await page.evaluate(()=>forceShowModal('quizCompareModal'));
   await page.waitForTimeout(120);
   assert(await page.locator('#quizCompareModal').isVisible());
   const close=page.getByRole('button',{name:'Close comparison'});
   if(key){await close.focus();await page.keyboard.press(key);}else await close.click();
   assert.equal(await page.locator('#quizCompareModal').isVisible(),false);
   assert.equal(await page.locator('#quizCompareModal').evaluate(n=>n.classList.contains('force-show')),false);
  }
  console.log('PASS: real Compare modal closes and reopens using click, Enter, and Space');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

