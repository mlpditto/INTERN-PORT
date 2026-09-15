const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(require('path').join(__dirname, '../public/delete-requests.js'), 'utf8');
const context = {window:{}, document:{addEventListener() {}}};
vm.createContext(context);
vm.runInContext(code.replace('    function adminUI() {', '    window.describeRequest = describeRequest;\n    function adminUI() {'), context);
(async () => {
    const data = {'users/user-1':{displayName:'Joeylive',pictureUrl:'https://example.com/avatar.png'},
        'quiz_attempts/quiz-1_user-1':{userId:'user-1',quizId:'quiz-1'}, 'quizzes/quiz-1':{title:'A, AN, THE'}};
    const read = async (collection,id) => data[collection+'/'+id] || null;
    const request = {itemType:'quiz',itemId:'quiz-1_user-1',userId:'user-1'};
    const result = await context.window.describeRequest(request,read);
    assert.equal(result.name,'Joeylive'); assert.equal(result.title,'A, AN, THE');
    assert.equal(result.picture,'https://example.com/avatar.png'); assert.equal(result.type,'Quiz attempt');
    delete data['quiz_attempts/quiz-1_user-1'];
    assert.equal((await context.window.describeRequest(request,read)).title,'A, AN, THE');
    delete data['users/user-1']; delete data['quizzes/quiz-1'];
    const missing = await context.window.describeRequest(request,read);
    assert.equal(missing.name,'User profile unavailable'); assert.equal(missing.title,'Original item unavailable');
    data['submissions/case-1']={userId:'different-user',title:'Wrong owner'};
    assert.notEqual((await context.window.describeRequest({...request,itemType:'case',itemId:'case-1'},read)).title,'Wrong owner');
    console.log('PASS: profile/photo, quiz title, legacy composite reference, missing records and owner isolation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
