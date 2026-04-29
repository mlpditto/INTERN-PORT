import re

file_path = 'public/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Case section
case_section_pattern = r'(<div id="section-cases"[^>]*>.*?</div>\s*</div>\s*</div>)'
case_match = re.search(case_section_pattern, content, re.DOTALL)

if case_match:
    case_section = case_match.group(1)
    
    # Remove Case section from its current position
    content_without_case = content[:case_match.start()] + content[case_match.end():]
    
    # Find the Work section end
    work_section_pattern = r'(<div id="section-general-work"[^>]*>.*?</div>\s*</div>\s*</div>)'
    work_match = re.search(work_section_pattern, content_without_case, re.DOTALL)
    
    if work_match:
        # Insert Case section after Work section
        new_content = (content_without_case[:work_match.end()] + 
                      '\n\n' + case_section + 
                      content_without_case[work_match.end():])
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print('✅ Successfully moved Case section after Work section!')
    else:
        print('❌ Could not find Work section')
else:
    print('❌ Could not find Case section')
