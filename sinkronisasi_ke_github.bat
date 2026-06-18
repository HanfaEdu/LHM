@echo off
title SiPaDi - Sinkronisasi Pembaruan ke GitHub
color 0E

echo =========================================================================
echo  SISTEM PERKEMBANGAN AKADEMIK DIGITAL TERINTEGRASI (SiPaDi)
echo  Mengirim Pembaruan Kode Terbaru ke GitHub Anda...
echo =========================================================================
echo.

:: Masuk ke folder proyek
f:
cd "F:\academic-progress-system"

:: Periksa apakah Git sudah terinisialisasi
if not exist ".git" (
    echo [ERROR] Repositori belum dihubungkan ke GitHub!
    echo Silakan jalankan file "upload_ke_github.bat" terlebih dahulu.
    echo.
    pause
    exit
)

echo [1/3] Mendeteksi perubahan file...
git add .

echo.
echo [2/3] Mencatat perubahan (Commit)...
git commit -m "Pembaruan kode otomatis oleh AI"

echo.
echo [3/3] Mengunggah perubahan ke GitHub...
git push

if %errorlevel% eq 0 (
    echo.
    echo =========================================================================
    echo  [SUKSES] Perubahan kode terbaru telah dikirim ke GitHub!
    echo  Vercel Anda akan mendeteksi ini dan melakukan update otomatis.
    echo =========================================================================
) else (
    echo.
    echo [ERROR] Gagal mengirim pembaruan ke GitHub.
    echo Pastikan koneksi internet aktif dan repositori GitHub masih tersedia.
)

echo.
pause
