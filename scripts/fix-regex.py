import re

file_path = 'public/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the corrupted regex by replacing the multi-line pattern
# The pattern has actual newlines instead of \n escape sequences
old_pattern = r"""userAns\.replace\(/
---
/g, '

'\)"""

new_pattern = r"userAns.replace(/\\n---\\n/g, '\\n\\n')"

# Use DOTALL flag to match across newlines
fixed_content = re.sub(old_pattern, new_pattern, content, flags=re.DOTALL)

if fixed_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    print('✅ Fixed regex corruption!')
    print('   Replaced actual newlines in regex with \\n escape sequences')
else:
    print('ℹ️  No corruption found or already fixed')
