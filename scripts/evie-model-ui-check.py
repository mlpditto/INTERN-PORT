from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'public/admin.html').read_text(encoding='utf-8')
ui = (root / 'public/ai-model-ui.js').read_text(encoding='utf-8')
start = html.index('        async function bulkPasteFindAnswers()')
batch = html[start:html.index('        // V97.23:', start)]
# V102.04: the model is picked on a logo chip that unfolds the shared provider rail (the select is hidden).
chip_js = html[html.index('        window.bpSyncModelChip = function()'):html.index('        function renderBulkPastePreview() {')]
rail_js = html[html.index('        window.browseAuditProvider = function'):html.index('        window.auditModelControlsHtml = function')]
logo_js = html[html.index('        window.aiModelLogoHtml = function'):html.index('        window.syncAuditFixHints = function')]
markup = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.S | re.I)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':390,'height':844})
    page.route('**/*', lambda r: r.fulfill(body='<html></html>', content_type='text/html') if r.request.is_navigation_request() else r.abort())
    page.goto('https://evie.test/')
    def load():
        page.set_content(markup, wait_until='domcontentloaded')
        page.evaluate('''() => {
            document.querySelectorAll('body > *').forEach(el => el.style.display='none');
            const modal=document.getElementById('bulkPasteModal');
            modal.style.display='block';modal.style.position='fixed';modal.style.inset='0';
            const content=modal.querySelector('.modal-content');
            content.style.boxSizing='border-box';content.style.width='100%';content.style.margin='0';
            document.getElementById('bp-input-stage').style.display='none';
            document.getElementById('bp-preview-stage').style.display='block';
        }''')
        page.evaluate('window.syncModelDefault = () => {}')
        page.add_script_tag(content=ui)
        page.evaluate('initRegistryModelSelectors()')
        page.evaluate("window.escapeHtml = s => String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'})[c]); window.textAIModelInfo = window.textAIModelInfo || (id => TEXT_AI_MODELS.find(m => m.id === id)); window.aiModelShortName = id => ((window.textAIModelInfo(id) || {}).short || id)")
        page.add_script_tag(content=rail_js + logo_js + chip_js)
        page.add_script_tag(content=batch)
        page.evaluate('bpSyncModelChip()')
    load()
    select = page.locator('#bp-ai-model')
    chip = page.locator('#bp-model-chip')
    assert select.locator('option').count() == page.evaluate('TEXT_AI_MODELS.length')
    assert not select.is_visible() and chip.is_visible()
    assert chip.get_attribute('data-model') == page.evaluate("aiModelShortName(document.getElementById('bp-ai-model').value)")
    chip.click()
    assert page.locator('#bp-model-rail').is_visible() and chip.get_attribute('aria-expanded') == 'true'
    page.locator('#bp-model-rail .audit-provider[data-provider="Claude"]').click()
    page.locator('#bp-model-rail [data-value="claude-haiku-4-5"]').click()
    assert not page.locator('#bp-model-rail').is_visible()
    assert page.evaluate("localStorage.getItem('ai_text_bp-ai-model')") == 'claude-haiku-4-5'
    assert chip.get_attribute('data-model') == 'Haiku 4.5'
    chip.click(); page.keyboard.press('Escape')
    assert not page.locator('#bp-model-rail').is_visible(), 'Esc closes the rail'
    load()
    assert select.input_value() == 'claude-haiku-4-5' and chip.get_attribute('data-model') == 'Haiku 4.5'
    page.evaluate('''() => {
        window._bulkPasteParsed=Array.from({length:10},()=>({include:true,q:'Test',options:['A','B'],correct:[]}));
        window.requestModels=[];window.disabledDuringRun=[];window.callUniversalAI=()=>{};
        document.getElementById('ai-analyzer-model-val').value='gpt-6-luna';
        window._aiFindAnswerCore=async(q,options,model)=>{
            requestModels.push(model);disabledDuringRun.push(document.getElementById('bp-ai-model').disabled && document.getElementById('bp-model-chip').disabled);
            return {picks:[0],conf:90,rationale:'Test'};
        };
        window.renderBulkPastePreview=()=>{};window.showToast=()=>{};
    }''')
    # V102.05: picking a model is the go signal. Nothing selected → only the model changes.
    page.evaluate('_bulkPasteParsed.forEach(r => r.include = false)')
    chip.click(); page.locator('#bp-model-rail [data-value="claude-opus-5-5"]').click()
    assert page.evaluate('requestModels.length') == 0, 'no run without selected questions'
    assert select.input_value() == 'claude-opus-5-5'
    # selected questions → the pick starts E.V.I.E. at once with that model (chip + select locked meanwhile)
    page.evaluate('_bulkPasteParsed.forEach(r => r.include = true)')
    chip.click(); page.locator('#bp-model-rail [data-value="claude-sonnet-5"]').click()
    page.wait_for_function('requestModels.length === 10')
    assert page.evaluate('requestModels') == ['claude-sonnet-5']*10, 'picking a model runs E.V.I.E. right away'
    assert page.evaluate('disabledDuringRun.every(Boolean)')
    page.wait_for_function("!document.getElementById('bp-model-chip').disabled")
    page.evaluate('requestModels.length = 0; disabledDuringRun.length = 0')
    # 🎯 still re-runs with the current model
    page.locator('#bp-find-btn').click()
    assert page.evaluate('requestModels') == ['claude-sonnet-5']*10
    assert page.evaluate('disabledDuringRun.every(Boolean)')
    assert select.is_enabled() and chip.is_enabled()
    assert page.locator('#ai-analyzer-model-val').input_value() == 'gpt-6-luna'
    bounds=chip.bounding_box()
    assert bounds['x']>=0 and bounds['x']+bounds['width']<=390
    print('PASS: shared model catalog, logo chip + rail pick (Esc closes), pick auto-runs E.V.I.E. (not without a selection), saved selection, 10 requests use EVIE model, run lock (select + chip), independent analyzer, mobile width')
    browser.close()
