import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

appsheet_sql_path = r'C:\Users\LENOVO\Downloads\AppsheetRLVN.sql'
with open(appsheet_sql_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

khtn_create = re.search(r'CREATE\s+TABLE\s+[`"]?KHTN[`"]?\s*\((.*?)\)\s*ENGINE', content, re.DOTALL | re.IGNORECASE)
if khtn_create:
    cols = []
    for l in khtn_create.group(1).splitlines():
        l = l.strip()
        if l.startswith('`'):
            cols.append(l.split('`')[1])
    print("KHTN Columns:")
    for idx, c in enumerate(cols):
        print(f"  {idx}: {c}")
else:
    print("KHTN not found")
