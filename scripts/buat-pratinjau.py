#!/usr/bin/env python3
"""Membuat gambar pratinjau tautan (og:image) dari logo sekolah.

    python3 scripts/buat-pratinjau.py

Menghasilkan public/pratinjau-192.png.

KENAPA 192px, BUKAN LOGO ASLINYA YANG 512px
-------------------------------------------
WhatsApp mengunduh gambar pratinjau lalu MENGUKUR SENDIRI ukurannya, dan
dari situ ia memutuskan bentuk kartunya: gambar yang cukup besar dan
persegi ditampilkan sebagai kartu besar yang memakan hampir seluruh lebar
layar, sementara gambar kecil ditampilkan sebagai thumbnail mungil di
samping judul.

Sekolah memilih bentuk yang ringkas -- nama dan logo terbaca, alamat
tautannya yang panjang tidak ikut memenuhi layar. Karena itu gambar
pratinjaunya sengaja dibuat kecil, bukan memakai logo 512px apa adanya.

Angka yang ditulis di dalam metadata (width/height) TIDAK menolong di
WhatsApp: ia mengabaikan angka itu dan memakai ukuran berkas yang
sebenarnya. Jadi berkasnya sendiri yang harus kecil. Angka di metadata
tetap ditulis jujur karena Facebook, Telegram, dan Slack justru
mempercayainya untuk menyiapkan kotak kartu sebelum gambarnya selesai
diunduh.

KENAPA DIRATAKAN KE PUTIH
-------------------------
public/logo.png berupa lingkaran di atas latar transparan. Aplikasi
perpesanan menampilkan bagian transparan itu dengan cara yang
berbeda-beda -- sebagian putih, sebagian hitam, sebagian kotak-kotak.
Diratakan ke putih di sini supaya hasilnya sama di semua tempat.
"""
from pathlib import Path

from PIL import Image

AKAR = Path(__file__).resolve().parent.parent
SUMBER = AKAR / 'public' / 'logo.png'
HASIL = AKAR / 'public' / 'pratinjau-192.png'
SISI = 192


def main() -> None:
    logo = Image.open(SUMBER).convert('RGBA')
    kecil = logo.resize((SISI, SISI), Image.LANCZOS)

    kanvas = Image.new('RGB', (SISI, SISI), '#ffffff')
    kanvas.paste(kecil, (0, 0), kecil)      # alpha logo dipakai sebagai masker
    kanvas.save(HASIL, 'PNG', optimize=True)

    print(f'{HASIL.relative_to(AKAR)}  {SISI}x{SISI}  {HASIL.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
