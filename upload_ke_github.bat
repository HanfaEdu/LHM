@echo off
title SiPaDi - Upload ke GitHub
color 0A

echo =========================================================================
echo  SISTEM PERKEMBANGAN AKADEMIK DIGITAL TERINTEGRASI (SiPaDi)
echo  Script Otomatis Unggah ke GitHub Anda
echo =========================================================================
echo.

:: 1. Cek apakah Git sudah terinstall
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git tidak ditemukan di komputer Anda!
    echo.
    echo Silakan unduh dan install Git terlebih dahulu di: https://git-scm.com/
    echo Setelah selesai menginstal Git, jalankan kembali script ini.
    echo.
    pause
    exit
)

:: 2. Konfirmasi Folder
f:
cd "F:\academic-progress-system"

echo [INFO] Menyiapkan repositori lokal...
if not exist ".git" (
    git init
    git branch -M main
)

:: 3. Meminta URL Repositori dari User
echo.
echo Silakan buat repositori baru di GitHub Anda (misal namanya: academic-progress-system).
echo JANGAN centang opsi "Add a README", "Add .gitignore", atau "Choose a license" saat membuat di GitHub.
echo.
set /p REPO_URL="Masukkan Link/URL Repositori GitHub Anda (contoh: https://github.com/username/nama-repo.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] URL Repositori tidak boleh kosong!
    pause
    exit
)

:: 4. Hubungkan remote
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

:: 5. Add dan Commit
echo.
echo [INFO] Menambahkan file proyek...
git add .
echo [INFO] Membuat catatan perubahan (Commit)...
git commit -m "Inisialisasi Proyek SiPaDi"

:: 6. Push ke GitHub
echo.
echo [INFO] Mengunggah data ke GitHub Anda...
echo (Jika muncul jendela login GitHub, silakan ikuti petunjuk loginnya)
echo.
git push -u origin main

if %errorlevel% eq 0 (
    echo.
    echo =========================================================================
    echo  [SUKSES] Proyek Anda berhasil diunggah ke GitHub!
    echo  Sekarang Anda bisa menyambungkannya ke Vercel untuk deployment otomatis.
    echo =========================================================================
) else (
    echo.
    echo [ERROR] Gagal mengunggah ke GitHub. 
    echo Pastikan URL repositori benar dan Anda memiliki hak akses menulis ke repositori tersebut.
)

echo.
pause
