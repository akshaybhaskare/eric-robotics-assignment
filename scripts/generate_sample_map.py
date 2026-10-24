"""Generate public/assets/maps/warehouse.pcd - a self-contained sample map.

Binary PCD with x y z rgb. Colours mimic the Insight.IO reference map:
white free space, black walls, pink restricted zones, grey obstacles.
Run:  python3 scripts/generate_sample_map.py   (needs numpy)
"""
import numpy as np

rng = np.random.default_rng(7)
CELL = 0.12
X0, X1, Y0, Y1 = -26, 14, -30, 24

xs = np.arange(X0, X1, CELL)
ys = np.arange(Y0, Y1, CELL)
gx, gy = np.meshgrid(xs, ys)
gx, gy = gx.ravel(), gy.ravel()


def rect(x0, x1, y0, y1):
    return (gx >= x0) & (gx <= x1) & (gy >= y0) & (gy <= y1)


# Free space: main hall + lower-left lobe, minus a couple of notches
free = rect(-11, 11, -23, 21) | rect(-24, -9, -27, -17) | rect(-3, 5, -30, -23)
free &= ~rect(7, 11, 15, 21) & ~rect(-11, -8, 18, 21)

# Wall = free cell near a non-free cell (via shifted masks on the grid)
H, W = len(ys), len(xs)
f2 = free.reshape(H, W)
near = np.zeros_like(f2)
for dy in range(-4, 5):
    for dx in range(-4, 5):
        near |= ~np.roll(np.roll(f2, dy, 0), dx, 1)
wall = (f2 & near).ravel()
wall &= rng.random(wall.size) > 0.12  # ragged edges

white = np.array([255, 255, 255])
col = np.tile(white, (gx.size, 1)).astype(np.uint8)

# Pink restricted zones (fill + darker outline)
zones = [(-9.5, -1, 11, 19), (-9.5, -2, 2, 7), (-4, 4.5, -4, 4),
         (1.5, 10, -21, -2), (-9.5, -4, -15, -9)]
for (a, b, c, d) in zones:
    m = rect(a, b, c, d) & free
    col[m] = (252, 226, 228)
    edge = m & ~(rect(a + .25, b - .25, c + .25, d - .25))
    col[edge] = (232, 150, 160)

# Inner dark obstacle blocks (racks)
for (a, b, c, d) in [(-6, -5.2, 12, 17), (3, 3.8, 5, 13), (-1, 0, -16, -8)]:
    col[rect(a, b, c, d) & free] = (95, 100, 105)

col[wall] = (12, 14, 16)

# Red laser hits scattered near the big lower-right zone edge
hit = rect(8.6, 10.2, -21, -3) & free & (rng.random(gx.size) < 0.10)
col[hit] = (214, 40, 48)

z = np.zeros(gx.size, dtype=np.float32)
z[wall] = rng.uniform(0, 1.4, wall.sum())

# Extra stacked wall points so the map has real height in orbit mode
wx, wy, wc = gx[wall], gy[wall], col[wall]
layers = []
for h in (0.5, 1.0, 1.5, 2.0, 2.5):
    layers.append((wx, wy, np.full(wx.size, h, np.float32), wc))

# Small dark clutter (people / pallets)
clut = []
for _ in range(28):
    cx, cy = rng.uniform(-9, 9), rng.uniform(-20, 18)
    n = 60
    px = cx + rng.normal(0, .22, n)
    py = cy + rng.normal(0, .22, n)
    clut.append((px, py, rng.uniform(0, .9, n).astype(np.float32),
                 np.tile((70, 80, 90), (n, 1)).astype(np.uint8)))

keep = free
parts_x = [gx[keep], *[l[0] for l in layers], *[c[0] for c in clut]]
parts_y = [gy[keep], *[l[1] for l in layers], *[c[1] for c in clut]]
parts_z = [z[keep], *[l[2] for l in layers], *[c[2] for c in clut]]
parts_c = [col[keep], *[l[3] for l in layers], *[c[3] for c in clut]]

x = np.concatenate(parts_x); y = np.concatenate(parts_y)
zz = np.concatenate(parts_z); c = np.concatenate(parts_c).astype(np.uint32)

# Tilt the whole map like the reference screenshot (about -9 degrees)
a = np.deg2rad(-9)
xr = x * np.cos(a) - y * np.sin(a)
yr = x * np.sin(a) + y * np.cos(a)

rgb = ((c[:, 0] << 16) | (c[:, 1] << 8) | c[:, 2]).astype(np.uint32).view(np.float32)
pts = np.zeros(x.size, dtype=[('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('rgb', '<f4')])
pts['x'], pts['y'], pts['z'], pts['rgb'] = xr, yr, zz, rgb

header = (
    "# .PCD v0.7 - Point Cloud Data file format\nVERSION 0.7\n"
    "FIELDS x y z rgb\nSIZE 4 4 4 4\nTYPE F F F F\nCOUNT 1 1 1 1\n"
    f"WIDTH {x.size}\nHEIGHT 1\nVIEWPOINT 0 0 0 1 0 0 0\nPOINTS {x.size}\nDATA binary\n"
)
with open("public/assets/maps/warehouse.pcd", "wb") as f:
    f.write(header.encode("ascii"))
    f.write(pts.tobytes())
print(x.size, "points")
