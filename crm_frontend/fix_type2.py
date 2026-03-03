import re
with open ('src/pages/admin/UserManagement.tsx', 'r') as f: text = f.read()

f_from = """    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });"""

f_to = """    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        roleId: "",
        reportsTo: "none",
    });"""

# Actually TS errors stated: missing `teamType` in {name:...} but REQUIRED in ... {name:.. teamType...} !!
# Thus TS infers `form` expects `teamType`. How is form signature evaluated? By the FIRST usage?
# The definition of UserDrawer props: editingUser?: User...
# `editingUser`? No, type Inference looks at variable initialization. If line 155 does NOT define teamType, but somewhere ELSE does...?
# "Argument of type .... is not assignable to type SetStateAction<.. teamType... >"
# Let me use regex substitution to thoroughly ensure `teamType` is completely stripped across EVERY object literal matching the state structure:

import sys

def replace(text):
    text = re.sub(r'teamType:\s*[\'"].*?[\'"]\s*,', '', text)
    text = re.sub(r',\s*teamType:\s*form\.teamType', '', text)
    text = re.sub(r',\s*teamType:\s*editingUser\.teamType', '', text)
    return text

with open ('src/pages/admin/UserManagement.tsx', 'w') as f: f.write(replace(text))
