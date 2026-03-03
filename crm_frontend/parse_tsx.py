import re

with open('src/pages/admin/UserManagement.tsx', 'r') as f:
    text = f.read()

text = re.sub(r'teamType:\s*[\'"].*?[\'"],?\s*', '', text)

# Just explicitly strip `teamType?: string;` and `teamType: string;` 
text = re.sub(r'teamType\??:\s*string;?', '', text)

with open('src/pages/admin/UserManagement.tsx', 'w') as f:
    f.write(text)
