import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

appsheet_sql_path = r'C:\Users\LENOVO\Downloads\AppsheetRLVN.sql'
with open(appsheet_sql_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

m = re.search(r'INSERT\s+INTO\s+[`"]?TRANG_THAI[`"]?\s+VALUES\s*(.*?);', content, re.DOTALL | re.IGNORECASE)
if m:
    print("TRANG_THAI Table:")
    print(m.group(1).strip())
