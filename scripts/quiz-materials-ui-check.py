from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'public/index.html').read_text(encoding='utf-8')
css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S))
css += (root / 'public/quiz-cover.css').read_text(encoding='utf-8')
helpers = html[html.index('        function quizMaterialActionsHtml('):html.index('        // V95.12: render a quiz')]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_content('<style>' + css + '</style><main></main>')
    page.evaluate('''() => {
        window.escapeHtml = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        window.materialDisplayName = (m,i) => m.name || 'Material '+(i+1);
        window.logged = 0; window.qzLogMaterialClick = () => logged++;
        window.liff = {isInClient:()=>true,openWindow:o=>window.opened=o};
    }''')
    page.add_script_tag(content=helpers)
    for width in [320,390,468,768]:
        page.set_viewport_size({'width':width,'height':700})
        page.evaluate('''() => {
            const details='<details class="quiz-mission-details"><summary>Details</summary><div>Quiz description</div></details>';
            const action=quizMaterialActionsHtml({id:'quiz',materials:[{url:'https://example.com/file.pdf',name:'Notes'}]});
            document.querySelector('main').innerHTML='<div class="assign-body" id="before">'+details+'</div><div class="assign-body" id="after"><div class="quiz-material-row"><div class="quiz-material-description">'+details+'</div>'+action+'</div></div>';
        }''')
        assert page.locator('#before').bounding_box()['height'] == page.locator('#after').bounding_box()['height']
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('a.quiz-material-download').click()
    assert page.evaluate('opened.external && logged === 1')
    assert page.evaluate('opened.url') == 'https://example.com/file.pdf'
    assert page.evaluate("quizMaterialActionsHtml({materials:[{url:'javascript:alert(1)'}]})") == ''
    page.evaluate('''() => document.querySelector('main').innerHTML=quizMaterialActionsHtml({id:'q',materials:[{url:'https://example.com/1',name:'One'},{url:'https://example.com/2',name:'Two'}]})''')
    assert not page.locator('.quiz-material-list').is_visible()
    page.locator('summary').click()
    assert page.locator('.quiz-material-list a').count() == 2
    assert page.locator('.quiz-material-list').is_visible()
    browser.close()
print('PASS: unchanged row height at 320/390/468/768px, LIFF external open, URL safety, multiple files')
