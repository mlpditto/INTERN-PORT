// V102.559: Smart Split when the copy lost the line break before option A. Runs the real helper from admin.html.
const assert = require('node:assert/strict'), fs = require('node:fs');
const html = fs.readFileSync('public/admin.html', 'utf8');
const i = html.indexOf('function splitGluedOptionA('), j = html.indexOf('function processQuizPaste(', i);
assert.ok(i > 0 && j > i);
const split = new Function(html.slice(i, j) + '; return splitGluedOptionA;')();
const out = split('ผู้ป่วยใช้ยา oxybutyninคำถาม: ข้อใดเหมาะสมที่สุด?A. หยอด latanoprost\n\nB. หยุดยาและส่งต่อ\n\nC. เปลี่ยนยา').split('\n');
assert.equal(out[0], 'ผู้ป่วยใช้ยา oxybutynin'); assert.equal(out[1], 'คำถาม: ข้อใดเหมาะสมที่สุด?'); assert.equal(out[2], 'A. หยอด latanoprost');
const fine = 'Which one?\nA. one\nB. two';
assert.equal(split(fine), fine, 'a normal paste stays as it is');
const noB = 'Vitamin A. It helps?A. maybe';
assert.equal(split(noB), noB, 'no B line: leave it');
console.log('PASS quiz-paste-glued-a');
