#!/usr/bin/env python3
"""
IH Field App — Build Script
Usage: python3 build.py

Reads index-dev.html + libs/*.js and produces index.html with all
libraries inlined for fully offline PWA deployment.
"""

import re, os, sys

DEV_FILE  = 'index-dev.html'
OUT_FILE  = 'index.html'
LIBS_DIR  = 'libs'

REPLACEMENTS = [
    ('jspdf.umd.min.js',  'jsPDF 2.5.1 — inlined for offline use'),
    ('xlsx.full.min.js',  'SheetJS 0.18.5 — inlined for offline use'),
    ('pdf.min.js',        'PDF.js 3.11.174 — inlined for offline/PWA use'),
    ('pdf.worker.min.js', 'PDF.js Worker 3.11.174 — inlined for offline use'),
]

def main():
    if not os.path.exists(DEV_FILE):
        print(f"ERROR: {DEV_FILE} not found"); sys.exit(1)

    html = open(DEV_FILE, encoding='utf-8').read()
    print(f"Input:  {DEV_FILE} ({len(html)//1024} KB)")

    for fname, comment in REPLACEMENTS:
        lib_path = os.path.join(LIBS_DIR, fname)
        if not os.path.exists(lib_path):
            print(f"ERROR: {lib_path} not found"); sys.exit(1)

        lib_content = open(lib_path, encoding='utf-8').read()
        tag = f'<script src="{LIBS_DIR}/{fname}"></script>'
        inline = f'<script>/* {comment} */\n{lib_content}\n</script>'

        if tag not in html:
            print(f"ERROR: script tag not found for {fname}"); sys.exit(1)

        html = html.replace(tag, inline)
        print(f"  Inlined {fname} ({len(lib_content)//1024} KB)")

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"Output: {OUT_FILE} ({len(html)//1024} KB)")
    print("Build complete.")

if __name__ == '__main__':
    main()
