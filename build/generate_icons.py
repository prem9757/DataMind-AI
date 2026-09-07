import zlib
import struct
import math

def create_png(width, height, pixels):
    """
    pixels is a list of bytearrays or bytes of length width * height * 4 (RGBA)
    """
    header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff)
    ihdr = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + ihdr_crc

    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        start = y * width * 4
        raw_data.extend(pixels[start:start + width * 4])

    idat_compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = struct.pack('>I', zlib.crc32(b'IDAT' + idat_compressed) & 0xffffffff)
    idat = struct.pack('>I', len(idat_compressed)) + b'IDAT' + idat_compressed + idat_crc

    iend_crc = struct.pack('>I', zlib.crc32(b'IEND') & 0xffffffff)
    iend = struct.pack('>I', 0) + b'IEND' + iend_crc

    return header + ihdr + idat + iend

def create_ico(png_data, width=256, height=256):
    # ICONDIR
    icondir = struct.pack('<HHH', 0, 1, 1)
    # ICONDIRENTRY (width and height: 0 means 256)
    w_byte = 0 if width >= 256 else width
    h_byte = 0 if height >= 256 else height
    direntry = struct.pack('<BBBBHHII', w_byte, h_byte, 0, 0, 1, 32, len(png_data), 22)
    return icondir + direntry + png_data

def generate():
    W, H = 256, 256
    pixels = bytearray(W * H * 4)

    def set_pixel(x, y, r, g, b, a=255):
        if 0 <= x < W and 0 <= y < H:
            idx = (y * W + x) * 4
            # Alpha blend with existing
            cur_a = pixels[idx+3] / 255.0
            new_a = a / 255.0
            out_a = new_a + cur_a * (1.0 - new_a)
            if out_a > 0:
                pixels[idx] = int((r * new_a + pixels[idx] * cur_a * (1.0 - new_a)) / out_a)
                pixels[idx+1] = int((g * new_a + pixels[idx+1] * cur_a * (1.0 - new_a)) / out_a)
                pixels[idx+2] = int((b * new_a + pixels[idx+2] * cur_a * (1.0 - new_a)) / out_a)
                pixels[idx+3] = int(out_a * 255)

    # Draw rounded rectangle background
    rad = 48
    bg_start_x, bg_start_y = 12, 12
    bg_w, bg_h = 232, 232

    for y in range(H):
        for x in range(W):
            # Check rounded box distance
            dx = max(bg_start_x + rad - x, 0, x - (bg_start_x + bg_w - rad))
            dy = max(bg_start_y + rad - y, 0, y - (bg_start_y + bg_h - rad))
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= rad:
                # Gradient from #1E232E (30, 35, 46) to #0B0D11 (11, 13, 17)
                t = (x + y) / (W + H)
                r = int(30 * (1 - t) + 11 * t)
                g = int(35 * (1 - t) + 13 * t)
                b = int(46 * (1 - t) + 17 * t)

                # Border stroke #2B3242 (43, 50, 66)
                is_border = (rad - 3 <= dist <= rad) or (x in (bg_start_x, bg_start_x+bg_w-1) and bg_start_y+rad <= y <= bg_start_y+bg_h-rad) or (y in (bg_start_y, bg_start_y+bg_h-1) and bg_start_x+rad <= x <= bg_start_x+bg_w-rad)
                if is_border:
                    r, g, b = 43, 50, 66

                set_pixel(x, y, r, g, b, 255)

    # Helper to draw filled rounded rect
    def draw_bar(bx, by, bw, bh, br, col_top, col_bot):
        for y in range(by, by + bh):
            for x in range(bx, bx + bw):
                dx = max(bx + br - x, 0, x - (bx + bw - br))
                dy = max(by + br - y, 0, y - (by + bh - br))
                if math.sqrt(dx*dx + dy*dy) <= br:
                    t = (y - by) / bh
                    r = int(col_top[0] * (1 - t) + col_bot[0] * t)
                    g = int(col_top[1] * (1 - t) + col_bot[1] * t)
                    b = int(col_top[2] * (1 - t) + col_bot[2] * t)
                    set_pixel(x, y, r, g, b, 255)

    # Grid line
    for x in range(48, 208):
        set_pixel(x, 188, 55, 65, 81, 255)
        set_pixel(x, 189, 55, 65, 81, 255)

    # Draw 4 analytics bars
    # Bar 1: Blue
    draw_bar(58, 136, 26, 52, 6, (59, 130, 246), (29, 78, 216))
    # Bar 2: Emerald
    draw_bar(98, 98, 26, 90, 6, (52, 211, 153), (5, 150, 105))
    # Bar 3: Indigo
    draw_bar(138, 120, 26, 68, 6, (129, 140, 248), (79, 70, 229))
    # Bar 4: Amber
    draw_bar(178, 66, 26, 122, 6, (251, 191, 36), (217, 119, 6))

    # Trend line joining points (71, 124), (111, 88), (151, 108), (191, 56)
    pts = [(71, 124), (111, 88), (151, 108), (191, 56)]
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i+1]
        steps = 100
        for s in range(steps + 1):
            t = s / steps
            lx = int(x0 * (1 - t) + x1 * t)
            ly = int(y0 * (1 - t) + y1 * t)
            for ox in (-1, 0, 1):
                for oy in (-1, 0, 1):
                    set_pixel(lx + ox, ly + oy, 245, 158, 11, 240)

    # Nodes on trend line
    for px, py in pts:
        for ox in range(-5, 6):
            for oy in range(-5, 6):
                if ox*ox + oy*oy <= 25:
                    set_pixel(px + ox, py + oy, 254, 240, 138, 255)

    png_data = create_png(W, H, pixels)
    with open('build/icon.png', 'wb') as f:
        f.write(png_data)

    ico_data = create_ico(png_data, W, H)
    with open('build/icon.ico', 'wb') as f:
        f.write(ico_data)

    print("Icons successfully generated: build/icon.png and build/icon.ico")

if __name__ == '__main__':
    generate()
