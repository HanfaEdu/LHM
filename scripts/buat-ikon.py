"""Membuat seluruh ikon PWA dari logo asli beresolusi tinggi.

    python3 scripts/buat-ikon.py

Hasilnya 54 berkas di public/ikon/ dan ikut disimpan ke repo -- ikon
sengaja dibuat lebih dulu, bukan digambar saat diminta. Menggambarnya
saat diminta berarti tiap pemasangan aplikasi bergantung pada satu
fungsi server yang berhasil jalan, dan ikon yang gagal dimuat
membatalkan pemasangan sama sekali.

Sumbernya scripts/logo-sumber.png (1024px). Sengaja di sini, bukan di
public/, supaya berkas sebesar itu tidak ikut disajikan ke pengunjung --
yang dipakai halaman adalah turunannya yang sudah diperkecil.

Jalankan ulang kalau logo sekolah suatu saat berubah.
"""
from PIL import Image, ImageDraw, ImageFont
import os, sys

SUMBER = sys.argv[1] if len(sys.argv) > 1 else 'scripts/logo-sumber.png'
TUJUAN = sys.argv[2] if len(sys.argv) > 2 else 'public/ikon'
FONT = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
LATAR, LENCANA, TEPI = (255,255,255,255), (11,19,41,255), (255,255,255,255)

LOGO = Image.open(SUMBER).convert('RGBA')

def buat(ukuran, huruf=None):
    """Ikon layar utama.

    Seluruh isinya sengaja berada di dalam lingkaran aman maskable (80%
    bagian tengah) supaya tidak terpotong saat Android memangkas ikon
    menjadi lingkaran, kotak membulat, atau bentuk lain sesuai peluncur
    yang dipakai pemiliknya:
      - logo    : 52% kanvas, pojoknya 0.37*ukuran dari pusat
      - lencana : pusat di 68% kanvas + jari-jari 0.133 = 0.387 dari pusat
    Keduanya di bawah batas aman 0.40.
    """
    kanvas = Image.new('RGBA', (ukuran, ukuran), LATAR)
    sisi = int(ukuran * 0.52)
    logo = LOGO.resize((sisi, sisi), Image.LANCZOS)
    pos = (ukuran - sisi) // 2
    kanvas.alpha_composite(logo, (pos, pos - int(ukuran * 0.04)))

    if huruf:
        g = ImageDraw.Draw(kanvas)
        cx = cy = int(ukuran * 0.68)
        r = int(ukuran * 0.133)
        g.ellipse([cx-r-2, cy-r-2, cx+r+2, cy+r+2], fill=TEPI)
        g.ellipse([cx-r, cy-r, cx+r, cy+r], fill=LENCANA)
        f = ImageFont.truetype(FONT, int(r * 1.35))
        k = g.textbbox((0, 0), huruf, font=f)
        g.text((cx-(k[2]+k[0])/2, cy-(k[3]+k[1])/2), huruf, font=f,
               fill=(255,255,255,255))

    # Kuantisasi 128 warna: pada ukuran ikon hasilnya tak terbedakan dari
    # warna penuh, tetapi berkasnya seperempat -- dan berkas ini ada 54.
    return kanvas.convert('RGB').quantize(colors=128, dither=Image.FLOYDSTEINBERG)

os.makedirs(TUJUAN, exist_ok=True)
for u in (192, 512):
    buat(u).save(f'{TUJUAN}/sipadi-{u}.png', optimize=True)
for h in [chr(c) for c in range(65, 91)]:
    for u in (192, 512):
        buat(u, h).save(f'{TUJUAN}/siswa-{u}-{h}.png', optimize=True)

total = sum(os.path.getsize(f'{TUJUAN}/{f}') for f in os.listdir(TUJUAN))
print('berkas:', len(os.listdir(TUJUAN)), '| total:', round(total/1024), 'KB')
