import re

with open("src/pages/admin/UserManagement.tsx", "r") as f:
    text = f.read()

text = re.sub(r'teamType:\s*form\.teamType\s*(?=,|}?)', '', text)
text = re.sub(r'teamType:\s*editingUser\.teamType\s*(?=,|}?)', '', text)
text = re.sub(r',\s*teamType\??:\s*string;?', '', text)
text = re.sub(r'teamType:\s*"",?\s*\n', '', text)

with open("src/pages/admin/UserManagement.tsx", "w") as f:
    f.write(text)
