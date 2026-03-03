import os
import re

file_path = 'src/pages/admin/UserManagement.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Remove 'teamType: string;' from User[] and interfaces in file
content = re.sub(r'\W*teamType\??:\s*string;?', '', content)
content = re.sub(r'const TEAM_TYPES.*?\];', '', content, flags=re.DOTALL)

# Fix form state object structure
content = re.sub(r'teamType:\s*[\'"].*?[\'"],?', '', content)

with open(file_path, 'w') as f:
    f.write(content)
