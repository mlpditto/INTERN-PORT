const fs=require('fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();
 await page.setContent('<div class="cert-reg-files"><button data-cert-file="MLP-test">View certificate</button><button data-cert-file="MLP-test" data-download="true">PDF</button><small data-file-status></small></div>');
 await page.addStyleTag({path:'public/certificate-files.css'});
 await page.evaluate(()=>{
  window.docs={};window.uploads=[];window.fail=false;window.alerts=[];window.alert=m=>alerts.push(m);
  const ref=path=>({path,collection:n=>({doc:id=>ref(path+'/'+n+'/'+id)}),get:async()=>({exists:!!docs[path],data:()=>docs[path]})});
  window.db={collection:n=>({doc:id=>ref(n+'/'+id)}),runTransaction:async fn=>fn({get:r=>r.get(),set:(r,d)=>{docs[r.path]=structuredClone(d)}})};
  window.adminApp={storage:()=>({ref:path=>({getDownloadURL:async()=> 'https://example.test/certificate.pdf',put:async blob=>{if(fail)throw Error('upload denied');uploads.push({path,size:blob.size});}})})};
  window.fetch=async()=>({ok:true,blob:async()=>new Blob(['%PDF-1.4'],{type:'application/pdf'})});
  window.firebase={firestore:{FieldValue:{serverTimestamp:()=>123}}};
  window.crypto.randomUUID=()=>String(uploads.length+1);
 });
 await page.addScriptTag({path:'public/certificate-files.js'});
 await page.evaluate(async()=>{await CertificateFiles.decorate()});
 assert.equal(await page.getByRole('button',{name:'PDF',exact:true}).isEnabled(),false);
 assert.match(await page.locator('[data-file-status]').innerText(),/not archived/);
 assert.equal(await page.evaluate(()=>CertificateFiles.archive('MLP-test',{output:()=>new Blob(['first'])})),true);
 const original=await page.evaluate(()=>docs['certificate_files/MLP-test'].original.path);
 assert.equal(await page.evaluate(()=>CertificateFiles.archive('MLP-test',{output:()=>new Blob(['second'])})),true);
 assert.equal(await page.evaluate(()=>docs['certificate_files/MLP-test'].original.path),original);
 assert.notEqual(await page.evaluate(()=>docs['certificate_files/MLP-test'].latest.path),original);
 await page.evaluate(()=>CertificateFiles.decorate());
 assert.equal(await page.getByRole('button',{name:'PDF',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'View certificate',exact:true}).click();
 assert.equal(await page.locator('dialog').isVisible(),true);
 assert.match(await page.locator('iframe').getAttribute('src'),/^blob:/);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('dialog').waitFor({state:'detached'});
 assert.equal(await page.locator('dialog').count(),0);
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'PDF',exact:true}).click();
 assert.equal((await downloadPromise).suggestedFilename(),'Certificate_MLP-test.pdf');
 await page.evaluate(()=>{fail=true});
 assert.equal(await page.evaluate(()=>CertificateFiles.archive('MLP-fail',{output:()=>new Blob(['x'])})),false);
 assert.equal(await page.evaluate(()=>!!docs['certificate_files/MLP-fail']),false);
 for(const width of [320,736]){await page.setViewportSize({width,height:800});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 const html=fs.readFileSync('public/admin.html','utf8');
 assert.equal((html.match(/if \(!await CertificateFiles.archive/g)||[]).length,3);
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){if(!/src=|type\s*=/.test(m[1]))new Function(m[2]);}
 console.log('PASS: private snapshots, first original preserved, legacy state, upload failure, responsive buttons, all three export paths, admin syntax. Firebase mocked.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
