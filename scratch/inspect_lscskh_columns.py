import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

appsheet_sql_path = r'C:\Users\LENOVO\Downloads\AppsheetRLVN.sql'
with open(appsheet_sql_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

ls_create = re.search(r'CREATE\s+TABLE\s+[`"]?LS_CSKH[`"]?\s*\((.*?)\)\s*ENGINE', content, re.DOTALL | re.IGNORECASE)
if ls_create:
    cols = []
    for l in ls_create.group(1).splitlines():
        l = l.strip()
        if l.startswith('`'):
            cols.append(l.split('`')[1])
    print("LS_CSKH Columns:")
    for idx, c in enumerate(cols):
        print(f"  {idx}: {c}")

ls_sub_create = re.search(r'CREATE\s+TABLE\s+[`"]?LS_CSKH_bangphu[`"]?\s*\((.*?)\)\s*ENGINE', content, re.DOTALL | re.IGNORECASE)
if ls_sub_create:
    cols = []
    for l in ls_sub_create.group(1).splitlines():
        l = l.strip()
        if l.startswith('`'):
            cols.append(l.split('`')[1])
    print("\nLS_CSKH_bangphu Columns:")
    for idx, c in enumerate(cols):
        print(f"  {idx}: {c}")
