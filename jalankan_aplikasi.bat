@echo off
title SiPaDi - Jalankan Aplikasi Lokal
color 0B

echo =========================================================================
echo  SISTEM PERKEMBANGAN AKADEMIK DIGITAL TERINTEGRASI (SiPaDi)
echo  SD Yaumi Fatimah Kudus - Script Pembuka Aplikasi
echo =========================================================================
echo.

:: 1. Periksa apakah Node.js sudah terinstall
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan pada komputer Anda!
    echo.
    echo Aplikasi ini membutuhkan Node.js agar bisa berjalan di komputer Anda.
    echo.
    echo CARA MENGATASI:
    echo 1. Unduh Node.js versi terbaru di: https://nodejs.org/ (pilih versi LTS)
    echo 2. Jalankan file installer yang diunduh dan ikuti panduan instalasinya sampai selesai.
    echo 3. Setelah instalasi selesai, buka kembali file "jalankan_aplikasi.bat" ini.
    echo.
    pause
    exit
)

echo [OK] Node.js terdeteksi.
echo.

:: 2. Masuk ke drive F dan folder proyek
f:
cd "F:\academic-progress-system"

:: 3. Periksa apakah folder node_modules sudah ada (artinya dependensi sudah terinstall)
if not exist "node_modules" (
    echo [INFO] Mengunduh komponen aplikasi (installing dependencies)...
    echo Ini hanya dilakukan sekali saat pertama kali menjalankan aplikasi. Harap tunggu...
    echo.
    call npm install
    echo.
    echo [OK] Komponen aplikasi berhasil diunduh.
    echo.
)

:: 4. Jalankan browser secara otomatis ke http://localhost:3000 setelah beberapa detik
echo [INFO] Menyalakan server aplikasi...
echo Browser Anda akan terbuka secara otomatis dalam beberapa detik.
echo.
start "" "http://localhost:3000"

:: 5. Jalankan server pengembangan Next.js
call npm run dev

pause
