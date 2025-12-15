# 🔐 Secure QR Vault - Final Project

**Secure QR Vault** adalah aplikasi web berbasis keamanan siber yang dirancang untuk mengamankan data sensitif (teks dan file) menggunakan enkripsi tingkat militer (AES-256 GCM). Data yang dienkripsi diubah menjadi QR Code untuk kemudahan distribusi, dilengkapi dengan fitur keamanan canggih seperti *Self-Destruct* (Burn-After-Reading) dan autentikasi terselubung (*Stealth Auth*).

![Banner Project](https://img.shields.io/badge/Status-Final_Project-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Backend-Flask-green?style=for-the-badge&logo=flask)
![Security](https://img.shields.io/badge/Security-AES--256_GCM-red?style=for-the-badge&logo=lock)
![Frontend](https://img.shields.io/badge/Frontend-Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss)

## ✨ Fitur Utama

* **🔒 Enkripsi AES-256 GCM:** Mengamankan pesan dan file dengan standar enkripsi tingkat lanjut.
* **🕵️ Stealth Authentication:** Halaman login tanpa tombol yang menggunakan **Time-Based PIN** (Jam + Menit Sistem) untuk masuk.
* **🔥 Burn-After-Reading:** Opsi untuk menghapus file/pesan secara permanen dari server setelah dibaca satu kali.
* **⏳ Expiry & Scan Limit:** Mengatur batas waktu kedaluwarsa dan batas jumlah pemindaian QR Code.
* **📷 Built-in QR Scanner:** Pemindai QR Code terintegrasi langsung di browser menggunakan kamera perangkat.
* **📱 Social Integration:** Fitur berbagi token langsung ke WhatsApp dan Bot Telegram.

## 📂 Struktur Folder

Pastikan struktur folder proyek Anda seperti ini agar aplikasi berjalan lancar:

```text
/Secure-QR-Vault
├── app.py                 # File utama backend Flask
├── scan_database.json     # Database lokal (JSON)
├── requirements.txt       # Daftar library Python
├── encrypted_storage/     # Folder penyimpanan file terenkripsi (otomatis dibuat)
├── static/                # Folder aset statis (CSS/JS)
│   ├── style.css
│   └── script.js
└── templates/             # Folder template HTML
    └── index.html