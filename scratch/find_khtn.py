import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:\Users\LENOVO\Downloads\AppsheetRLVN.sql', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        if 'KHTN' in line and 'INSERT' in line:
            print(line[:100])
