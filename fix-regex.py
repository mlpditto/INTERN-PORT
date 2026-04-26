import re

file_path = 'd:/20250728OD/OneDrive/Apps/WEBAPP/INTERN-PORT/index.html'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix regex pattern
content = content.replace(
    r"userAns.replace(/\\n---\\n/g, '\\n\\n');",
    r"userAns.replace(/\n---\n/g, '\n\n');"
)

# Write file
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ Fixed regex in index.html')
