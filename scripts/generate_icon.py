import os
import zlib
import struct
import math

os.makedirs('build', exist_ok=True)

width = 256
height = 256

# Generate RGBA image pixels
raw_rows = []
for y in range(height):
    row = bytearray([0]) # Filter type 0 (None)
    for x in range(width):
        # Center coordinates normalized to [-1, 1]
        nx = (x - 127.5) / 127.5
        ny = (y - 127.5) / 127.5
        dist = math.sqrt(nx * nx + ny * ny)

        # Rounded rectangle background (radius ~ 48px)
        rx = max(0, abs(x - 127.5) - (128 - 48))
        ry = max(0, abs(y - 127.5) - (128 - 48))
        corner_dist = math.sqrt(rx * rx + ry * ry)

        if corner_dist > 48:
            # Transparent outside squircle
            row.extend([0, 0, 0, 0])
            continue

        # Antialiasing edge
        alpha = 255
        if corner_dist > 46:
            alpha = int(255 * max(0.0, min(1.0, (48 - corner_dist) / 2.0)))

        # Background gradient: Dark navy #0B0F19 to #1E293B
        t = (y / 255.0)
        bg_r = int(11 * (1 - t) + 26 * t)
        bg_g = int(15 * (1 - t) + 38 * t)
        bg_b = int(25 * (1 - t) + 59 * t)

        # Border outline accent (1px cyan glow near edge)
        is_border = 44 <= corner_dist <= 47.5
        if is_border:
            r, g, b = 56, 189, 248 # Cyan 400
            row.extend([r, g, b, alpha])
            continue

        # Draw analytical bar charts and trend sparkline
        # Bar 1: x in [56..88], y in [130..196]
        # Bar 2: x in [104..136], y in [95..196]
        # Bar 3: x in [152..184], y in [60..196]
        is_bar1 = 56 <= x <= 88 and 130 <= y <= 196
        is_bar2 = 104 <= x <= 136 and 95 <= y <= 196
        is_bar3 = 152 <= x <= 184 and 60 <= y <= 196

        if is_bar1:
            # Teal / Cyan gradient
            bt = (y - 130) / 66.0
            r = int(56 * (1 - bt) + 14 * bt)
            g = int(189 * (1 - bt) + 165 * bt)
            b = int(248 * (1 - bt) + 233 * bt)
            row.extend([r, g, b, alpha])
        elif is_bar2:
            # Indigo / Violet gradient
            bt = (y - 95) / 101.0
            r = int(99 * (1 - bt) + 79 * bt)
            g = int(102 * (1 - bt) + 70 * bt)
            b = int(241 * (1 - bt) + 229 * bt)
            row.extend([r, g, b, alpha])
        elif is_bar3:
            # Purple / Fuchsia gradient
            bt = (y - 60) / 136.0
            r = int(168 * (1 - bt) + 147 * bt)
            g = int(85 * (1 - bt) + 51 * bt)
            b = int(247 * (1 - bt) + 234 * bt)
            row.extend([r, g, b, alpha])
        else:
            # Sparkline line joining tops (72, 130) -> (120, 95) -> (168, 60)
            # and AI Sparkle Star near (195, 55)
            # Distance to sparkline segments:
            in_sparkline = False
            # Check segments
            for (x1, y1), (x2, y2) in [((72, 130), (120, 95)), ((120, 95), (168, 60))]:
                dx = x2 - x1
                dy = y2 - y1
                l2 = dx*dx + dy*dy
                t_seg = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / l2))
                px = x1 + t_seg * dx
                py = y1 + t_seg * dy
                dist_seg = math.sqrt((x - px)**2 + (y - py)**2)
                if dist_seg <= 2.5:
                    in_sparkline = True
                    break
            
            # AI sparkle near top right (200, 52)
            sx, sy = 200, 52
            sd = math.sqrt((x - sx)**2 + (y - sy)**2)
            is_sparkle = (abs(x - sx) <= 1.5 and abs(y - sy) <= 10) or (abs(y - sy) <= 1.5 and abs(x - sx) <= 10) or (sd <= 3.5)

            if in_sparkline:
                row.extend([244, 244, 245, alpha]) # Light gray/white
            elif is_sparkle:
                row.extend([253, 224, 71, alpha]) # Yellow/Amber 300 AI sparkle
            else:
                row.extend([bg_r, bg_g, bg_b, alpha])

    raw_rows.append(bytes(row))

raw_data = b''.join(raw_rows)
compressed_data = zlib.compress(raw_data, 9)

def make_chunk(chunk_type, data):
    length = struct.pack('>I', len(data))
    crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
    return length + chunk_type + data + crc

# PNG construction
png_header = b'\x89PNG\r\n\x1a\n'
ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0) # 8-bit depth, RGBA (6)
ihdr_chunk = make_chunk(b'IHDR', ihdr_data)
idat_chunk = make_chunk(b'IDAT', compressed_data)
iend_chunk = make_chunk(b'IEND', b'')

png_bytes = png_header + ihdr_chunk + idat_chunk + iend_chunk

with open('build/icon.png', 'wb') as f:
    f.write(png_bytes)

# ICO construction (Vista+ PNG container inside ICO)
# ICONDIR (6 bytes): reserved=0, type=1 (ICO), count=1
icondir = struct.pack('<HHH', 0, 1, 1)

# ICONDIRENTRY (16 bytes):
# width (0 for 256), height (0 for 256), color count (0), reserved (0),
# planes (1), bpp (32), bytesize (len(png)), offset (22)
icondirentry = struct.pack('<BBBBHHII', 0, 0, 0, 0, 1, 32, len(png_bytes), 22)

ico_bytes = icondir + icondirentry + png_bytes

with open('build/icon.ico', 'wb') as f:
    f.write(ico_bytes)

print(f"Generated build/icon.png ({len(png_bytes)} bytes) and build/icon.ico ({len(ico_bytes)} bytes)")
