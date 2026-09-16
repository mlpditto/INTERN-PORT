from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'public/index.html').read_text(encoding='utf-8')
def take(start, end):
    a = html.index(start)
    return html[a:html.index(end, a)]
css = '\n'.join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S))
css += (root / 'public/case-insight-rail.css').read_text(encoding='utf-8')
markup = take('                        <div id="case-pane-systems"', '                        <!-- V96.78: Product Listing')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(accept_downloads=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content('<style>' + css + '</style><button id="case-tab-systems"></button><button id="case-tab-submit"></button><div id="case-pane-submit"></div>' + markup)
    page.evaluate('''() => {
        window.caseTaxonomyCatalog=[{key:'gi',label:'GI'},{key:'neuro',label:'Neurological'},{key:'resp',label:'Respiratory'},{key:'other',label:'Other'}];
        window.CASE_SYSTEM_EMOJI={gi:'🩺',neuro:'🧠',resp:'🫁',other:'📋'};
        window.getBangkokDateTimeParts=d=>({dateKey:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)});
        window.getCaseSystemName=c=>caseTaxonomyCatalog.find(x=>x.key===c.diseaseSystemKey).label;
        window.myCasesCache=['gi','neuro','other'].map((key,i)=>({caseId:'DEMO-'+i,diseaseSystemKey:key,status:'reviewed',symptomTags:['Sample symptom'],adminBonus:.1,note:'Sample note',timestamp:{toMillis:()=>Date.now()-i*40*86400000,toDate:()=>new Date(Date.now()-i*40*86400000)}}));
        window.userProfile={displayName:'Demo'};
    }''')
    for code in [take('        function escapeHtml(', '        // ─'), take('        function switchCaseTab(', '        // V96.78: Product kept'), take('        function renderCaseStats(', '        function initCaseComposer('), take('        function setCaseSystemFilter(', '        async function submitCase('), take('        function renderCaseGrouped(', '        initCaseComposer();')]:
        page.add_script_tag(content=code)
    page.evaluate('window.tintCaseSection=()=>{}; switchCaseTab("stats")')
    assert page.evaluate('caseActiveTab') == 'systems'
    assert page.locator('.case-card').count() == 3
    assert '2/3' in page.locator('.case-rail-metrics').inner_text()
    for width in [1440,768,390,320]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
        if width <= 700:
            page.evaluate('document.getElementById("case-stats-pane-content").classList.remove("is-expanded")')
            assert not page.locator('.case-rail-extra').is_visible()
            page.locator('.case-rail-mobile').click()
            assert page.locator('.case-rail-extra').is_visible()
    page.get_by_role('button', name='GI (1)', exact=True).click()
    assert page.locator('.case-card').count() == 1
    assert '0.30' in page.locator('.case-rail-metrics').inner_text()
    page.locator('#case-stats-pane-content select').select_option('7d')
    assert '0.10' in page.locator('.case-rail-metrics').inner_text()
    assert page.locator('.case-card').count() == 1
    assert page.locator('.case-rail-mobile').get_attribute('aria-expanded') == 'true'
    with page.expect_download() as download:
        page.locator('button[aria-label="ส่งออก CSV"]').click()
    assert download.value.suggested_filename.endswith('.csv')
    page.evaluate('renderCaseGrouped([])')
    assert '0.00' in page.locator('.case-rail-metrics').inner_text()
    assert '0/3' in page.locator('.case-rail-metrics').inner_text()
    assert not errors, errors
    browser.close()
print('PASS: merged tab alias, live refresh, mobile collapse, 320-1440px fit, filters, periods, CSV, empty state')
