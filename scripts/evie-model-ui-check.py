from pathlib import Path
import re
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = (root / 'public/admin.html').read_text(encoding='utf-8')
ui = (root / 'public/ai-model-ui.js').read_text(encoding='utf-8')
start = html.index('        async function bulkPasteFindAnswers()')
batch = html[start:html.index('        // V97.23:', start)]
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
        page.add_script_tag(content=batch)
    load()
    select = page.get_by_label('E.V.I.E. model', exact=True)
    assert select.locator('option').count() == page.evaluate('TEXT_AI_MODELS.length')
    assert select.is_visible()
    select.select_option('claude-haiku-4-5')
    assert page.evaluate("localStorage.getItem('ai_text_bp-ai-model')") == 'claude-haiku-4-5'
    load()
    assert select.input_value() == 'claude-haiku-4-5'
    page.evaluate('''() => {
        window._bulkPasteParsed=Array.from({length:10},()=>({include:true,q:'Test',options:['A','B'],correct:[]}));
        window.requestModels=[];window.disabledDuringRun=[];window.callUniversalAI=()=>{};
        document.getElementById('ai-analyzer-model-val').value='gpt-5.6-luna';
        window._aiFindAnswerCore=async(q,options,model)=>{
            requestModels.push(model);disabledDuringRun.push(document.getElementById('bp-ai-model').disabled);
            return {picks:[0],conf:90,rationale:'Test'};
        };
        window.renderBulkPastePreview=()=>{};window.showToast=()=>{};
    }''')
    page.locator('#bp-find-btn').click()
    assert page.evaluate('requestModels') == ['claude-haiku-4-5']*10
    assert page.evaluate('disabledDuringRun.every(Boolean)')
    assert select.is_enabled()
    assert page.locator('#ai-analyzer-model-val').input_value() == 'gpt-5.6-luna'
    bounds=select.bounding_box()
    assert bounds['x']>=0 and bounds['x']+bounds['width']<=390
    print('PASS: shared model catalog, saved selection, 10 requests use EVIE model, run lock, independent analyzer, mobile width')
    browser.close()
