import os
path = "admin.html"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

# Target part of the Translate toolbar
target_typhoon = '<div class="glass-toggle-item" data-value="typhoon-v2.5-30b-a3b-instruct" onclick="selectAiToolbarToggle(this,\'toolbar-ai-translate-model\')" style="font-size:0.62em; font-weight:800; padding:3px 7px; border-radius:6px; color:#94a3b8;">Typhoon</div>'
llama_html = '\n                                <div class="glass-toggle-item" data-value="meta-llama/Llama-3.3-70B-Instruct-Turbo" onclick="selectAiToolbarToggle(this,\'toolbar-ai-translate-model\')" title="Llama" style="font-size:0.62em; font-weight:800; padding:3px 7px; border-radius:6px; color:#94a3b8;">Llama</div>'

if target_typhoon in content:
    if llama_html.strip() not in content:
        new_content = content.replace(target_typhoon, target_typhoon + llama_html)
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("SUCCESS: Llama added to Translate toolbar.")
    else:
        print("INFO: Llama already exists.")
else:
    print("ERROR: Typhoon marker not found.")
