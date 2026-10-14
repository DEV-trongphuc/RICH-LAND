import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\LENOVO\Downloads\AppsheetRLVN.sql', 'r', encoding='utf-8', errors='ignore') as f:
    capture = False
    for line in f:
        if 'INSERT INTO `TRANG_THAI`' in line:
            capture = True
        if capture:
            print(line.strip())
            if ';' in line:
                break
