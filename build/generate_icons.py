#!/usr/bin/env python3
"""
Generate high-fidelity Windows icon assets (.ico and .png)
for Smart Data Analysis Assistant using the new application branding.

Resolutions included in build/icon.ico:
- 16x16
- 24x24
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256
"""

import os
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
BUILD_DIR = os.path.join(PROJECT_ROOT, 'build')
SOURCE_IMG = os.path.join(PROJECT_ROOT, 'src/assets/images/app_logo_icon_1788891470295.jpg')

def generate_icons():
    os.makedirs(BUILD_DIR, exist_ok=True)
    icon_png = os.path.join(BUILD_DIR, 'icon.png')
    icon_ico = os.path.join(BUILD_DIR, 'icon.ico')

    # 1. Generate 256x256 PNG
    subprocess.run(['convert', SOURCE_IMG, '-resize', '256x256', icon_png], check=True)

    # 2. Generate multi-resolution ICO covering 256, 128, 64, 48, 32, 24, 16
    subprocess.run([
        'convert',
        SOURCE_IMG,
        '-define',
        'icon:auto-resize=256,128,64,48,32,24,16',
        icon_ico
    ], check=True)

    print(f"Successfully generated Windows icons:")
    print(f"  - {icon_png} (256x256 PNG)")
    print(f"  - {icon_ico} (16, 24, 32, 48, 64, 128, 256 resolutions)")

if __name__ == '__main__':
    generate_icons()
