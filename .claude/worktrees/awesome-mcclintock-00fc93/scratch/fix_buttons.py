import os
path = "admin.html"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Lines to remove (duplicate Save/Cancel in the question item template)
target = """                            <div style="display:flex; gap:4px;">
                                <button type="button" class="btn-sm btn-secondary" onclick="forceHideModal('quizManageModal')" style="padding:4px 8px; font-size:0.65em; background:#64748b; color:white; border:none; border-radius:6px;">Cancel</button>
                                <button type="button" class="btn-sm btn-primary" onclick="saveQuiz()" style="padding:4px 8px; font-size:0.65em; background:var(--primary); color:white; border:none; border-radius:6px;">Save Quiz</button>
                            </div>"""

if target in content:
    new_content = content.replace(target, "")
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("SUCCESS: Duplicate buttons removed.")
else:
    # Try a looser match if whitespace differs
    import re
    pattern = re.compile(r'<div style="display:flex; gap:4px;">\s*<button type="button" class="btn-sm btn-secondary" onclick="forceHideModal\(\'quizManageModal\'\)".*?>Cancel</button>\s*<button type="button" class="btn-sm btn-primary" onclick="saveQuiz\(\)".*?>Save Quiz</button>\s*</div>', re.DOTALL)
    if pattern.search(content):
        new_content = pattern.sub("", content)
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("SUCCESS: Duplicate buttons removed via Regex.")
    else:
        print("ERROR: Target buttons not found.")
