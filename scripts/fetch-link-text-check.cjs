// V101.77: harness for the fetchLinkText Cloud Function (Expand Quiz ✏️ Custom links).
// Slices the REAL helpers out of functions/index.js (SSRF guard + HTML → text) and
// drives them with builtins only — CI does not install the functions' node_modules.
//   node scripts/fetch-link-text-check.cjs
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('const LINK_BLOCK = ');
const b = src.indexOf('exports.fetchLinkText = ');
if (a < 0 || b < 0) { console.error('markers not found in functions/index.js'); process.exit(1); }
const h = new Function('require', src.slice(a, b) + '\nreturn { linkAddressBlocked, linkHostCheck, linkSafeLookup, linkTextFromHtml, linkCharset, LINK_TEXT_MAX };')(require);

const checks = [];
const check = (name, got, want) => checks.push([name, JSON.stringify(got), JSON.stringify(want)]);

// address blocklist
['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
 '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254', 'not-an-ip']
    .forEach(ip => check(`blocked: ${ip}`, h.linkAddressBlocked(ip), true));
['8.8.8.8', '93.184.215.14', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']
    .forEach(ip => check(`allowed: ${ip}`, h.linkAddressBlocked(ip), false));

// host / protocol / port
check('host: https public ok', h.linkHostCheck('https:', 'www.ncbi.nlm.nih.gov', ''), '');
check('host: http port 80 ok', h.linkHostCheck('http:', 'example.com', '80'), '');
check('host: file: refused', !!h.linkHostCheck('file:', '', ''), true);
check('host: ftp: refused', !!h.linkHostCheck('ftp:', 'example.com', ''), true);
check('host: port 8080 refused', !!h.linkHostCheck('http:', 'example.com', '8080'), true);
check('host: localhost refused', !!h.linkHostCheck('http:', 'localhost', ''), true);
check('host: metadata.google.internal refused', !!h.linkHostCheck('http:', 'metadata.google.internal', ''), true);
check('host: IP literal 169.254.169.254 refused', !!h.linkHostCheck('http:', '169.254.169.254', ''), true);
check('host: bracketed [::1] refused', !!h.linkHostCheck('http:', '[::1]', ''), true);
check('host: public IP literal ok', h.linkHostCheck('https:', '1.1.1.1', ''), '');

// HTML → text
const html = `<html><head><title>Warfarin &amp; INR</title><style>.x{}</style><script>var s="hidden";</script></head>
<body><nav>Menu Home About</nav><header>Site header</header>
<main><h1>Warfarin</h1><p>Target INR 2&ndash;3 for AF.<br>Check INR &#8805; weekly.</p>
<ul><li>Vitamin K antagonist</li><li>Many interactions</li></ul>
<table><tr><td>Drug</td><td>Effect</td></tr></table><!-- comment --></main>
<footer>© 2026</footer></body></html>`;
const out = h.linkTextFromHtml(html);
check('html: title decoded', out.title, 'Warfarin & INR');
check('html: script/style/nav/header/footer dropped', /hidden|Menu|Site header|©|\.x\{\}/.test(out.text), false);
check('html: main content kept', /Target INR 2–3 for AF\.\nCheck INR ≥ weekly\./.test(out.text), true);
check('html: list items on own lines', /Vitamin K antagonist\s*\n+\s*Many interactions/.test(out.text), true);
check('html: comment dropped', /comment/.test(out.text), false);
const art = h.linkTextFromHtml('<body><p>Sidebar junk</p><article>Short</article><article>The long real article body text</article></body>');
check('html: largest <article> wins', art.text, 'The long real article body text');
check('charset: header wins', h.linkCharset('text/html; charset=windows-874', Buffer.from('')), 'windows-874');
check('charset: meta fallback', h.linkCharset('text/html', Buffer.from('<meta charset="tis-620">')), 'tis-620');
check('charset: default utf-8', h.linkCharset('text/html', Buffer.from('<p>x</p>')), 'utf-8');

// connect-time DNS guard: "localhost" resolves to loopback without any network
h.linkSafeLookup('localhost', { all: true }, (err) => {
    check('lookup: name resolving to loopback is refused', err && err.code, 'LINK_BLOCKED');
    let fail = 0;
    for (const [name, got, want] of checks) {
        const ok = got === want;
        if (!ok) fail++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got}${ok ? '' : `  want=${want}`}`);
    }
    console.log(fail ? `\n${fail} check(s) failed` : '\nall checks passed');
    process.exit(fail ? 1 : 0);
});
