import os
import json
import base64
import secrets
import time
import requests
import uuid 
from io import BytesIO

from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

# Kriptografi
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import qrcode

app = Flask(__name__)

# --- KONFIGURASI ---
UPLOAD_FOLDER = 'encrypted_storage'
DB_FILE = 'scan_database.json'  # File Database Sederhana

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# [PENTING] TOKEN TELEGRAM
TELEGRAM_BOT_TOKEN = "8336532278:AAGdYOjNOMv2hKw6RGvJEnkCEh7ZvtBJH7s"

# --- HELPER DATABASE JSON ---
def load_db():
    if not os.path.exists(DB_FILE):
        return {}
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except: return {}

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def update_scan_count(qr_id, limit):
    """
    Cek apakah boleh scan. 
    Return True jika boleh, False jika habis.
    """
    db = load_db()
    
    if qr_id not in db:
        # Jika ID baru (atau database terhapus), kita inisialisasi ulang
        # (Dalam kasus nyata ini jarang, anggap saja scan ke-1)
        db[qr_id] = 1
        save_db(db)
        return True
    
    current_count = db[qr_id]
    
    if current_count >= limit:
        return False  # BATAS HABIS
    
    # Increment count
    db[qr_id] = current_count + 1
    save_db(db)
    return True

class CryptoManager:
    def derive_key(self, password: str, salt: bytes) -> bytes:
        return PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100000,
        ).derive(password.encode())

    def encrypt_bytes(self, data_bytes, password):
        salt = secrets.token_bytes(16)
        nonce = secrets.token_bytes(12)
        key = self.derive_key(password, salt)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, data_bytes, None)
        return salt + nonce + ciphertext

    def decrypt_bytes(self, encrypted_data_bytes, password):
        try:
            salt = encrypted_data_bytes[:16]
            nonce = encrypted_data_bytes[16:28]
            ciphertext = encrypted_data_bytes[28:]
            key = self.derive_key(password, salt)
            aesgcm = AESGCM(key)
            return aesgcm.decrypt(nonce, ciphertext, None)
        except Exception:
            return None

crypto = CryptoManager()

# --- HELPER TELEGRAM ---
def send_telegram_photo(chat_id, photo_base64, caption):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
    if "," in photo_base64: _, encoded = photo_base64.split(",", 1)
    else: encoded = photo_base64
    binary_data = base64.b64decode(encoded)
    files = {'photo': ('secure_qr.png', binary_data, 'image/png')}
    data = {'chat_id': chat_id, 'caption': caption, 'parse_mode': 'Markdown'}
    try:
        response = requests.post(url, data=data, files=files)
        return response.json()
    except Exception as e:
        return {"ok": False, "description": str(e)}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/encrypt', methods=['POST'])
def encrypt_route():
    try:
        password = request.form.get('password')
        expiry = float(request.form.get('expiry', 24))
        max_scans = int(request.form.get('max_scans', 5))
        uploaded_file = request.files.get('file')
        text_message = request.form.get('text')

        if not password: return jsonify({'error': 'Password wajib!'}), 400

        # 1. GENERATE UNIQUE ID
        qr_id = str(uuid.uuid4())

        # 2. SIMPAN ID KE DATABASE (Start count dari 0)
        db = load_db()
        db[qr_id] = 0
        save_db(db)

        payload_data = {
            "id": qr_id,        # Simpan ID di dalam QR
            "exp": time.time() + (expiry * 3600),
            "lim": max_scans,
            "burn": True 
        }

        if uploaded_file and uploaded_file.filename != '':
            filename = secure_filename(uploaded_file.filename)
            file_bytes = uploaded_file.read()
            encrypted_file_bytes = crypto.encrypt_bytes(file_bytes, password)
            enc_filename = f"{int(time.time())}_{filename}.enc"
            save_path = os.path.join(UPLOAD_FOLDER, enc_filename)
            with open(save_path, 'wb') as f: f.write(encrypted_file_bytes)
            payload_data.update({"type":"file", "fname":filename, "path":enc_filename, "msg":f"File: {filename}"})
            
        elif text_message:
            payload_data.update({"type":"text", "msg":text_message})
        else:
            return jsonify({'error': 'Input kosong!'}), 400

        payload_json = json.dumps(payload_data)
        final_token_bytes = crypto.encrypt_bytes(payload_json.encode(), password)
        final_token_b64 = base64.urlsafe_b64encode(final_token_bytes).decode('utf-8')

        qr = qrcode.QRCode(box_size=10, border=2)
        qr.add_data(final_token_b64)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return jsonify({
            'qr_image': f"data:image/png;base64,{img_str}",
            'encrypted_data': final_token_b64
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/decrypt', methods=['POST'])
def decrypt_route():
    try:
        data = request.json
        token = data.get('token')
        password = data.get('password')
        
        token_bytes = base64.urlsafe_b64decode(token)
        decrypted_json_bytes = crypto.decrypt_bytes(token_bytes, password)
        
        if not decrypted_json_bytes: return jsonify({'success': False, 'message': 'Password Salah/QR Rusak!'})
        
        payload = json.loads(decrypted_json_bytes.decode())
        
        # 1. CEK WAKTU
        if time.time() > payload['exp']: return jsonify({'success': False, 'message': 'QR Code Sudah Kadaluarsa!'})

        # 2. CEK BATAS SCAN
        qr_id = payload.get('id')
        max_limit = payload.get('lim', 5)
        
        # Cek dulu counter di database (JANGAN UPDATE DULU)
        db = load_db()
        current_count = db.get(qr_id, 0)

        if current_count >= max_limit:
             return jsonify({'success': False, 'message': f'AKSES DITOLAK: Batas Scan Habis ({max_limit}x)!'})

        # Kalau aman, baru kita update +1
        update_scan_count(qr_id, max_limit)
        current_scan_count = current_count + 1 # Ini scan ke berapa sekarang

        response = {
            'success': True,
            'type': payload.get('type', 'text'),
            'message': payload['msg'],
            'meta': f"Scan ke-{current_scan_count} dari {max_limit}", # Info Scan
            'burned': False
        }

        if payload.get('type') == 'file':
            enc_path = os.path.join(UPLOAD_FOLDER, payload['path'])
            if os.path.exists(enc_path):
                with open(enc_path, 'rb') as f: enc_file_bytes = f.read()
                decrypted_file = crypto.decrypt_bytes(enc_file_bytes, password)
                response['file_data'] = base64.b64encode(decrypted_file).decode('utf-8')
                response['file_name'] = payload['fname']
                
                # --- [LOGIKA BARU: SMART BURN] ---
                # Hapus file HANYA JIKA scan sudah mencapai batas maksimal
                if payload.get('burn', True):
                    if current_scan_count >= max_limit:
                        try:
                            os.remove(enc_path)
                            response['burned'] = True
                            response['meta'] += " | [FILE TERAKHIR - DIMUSNAHKAN]"
                        except: pass
                    else:
                        response['meta'] += " | [FILE DISIMPAN UNTUK SCAN BERIKUTNYA]"
                # ---------------------------------
            else:
                return jsonify({'success': False, 'message': 'File sudah hilang/dihancurkan!'})
        return jsonify(response)
    except Exception as e: 
        print(f"Error: {e}")
        return jsonify({'success': False, 'message': 'Error System!'})

@app.route('/api/send-telegram', methods=['POST'])
def send_telegram_route():
    try:
        data = request.json
        chat_id = data.get('chat_id')
        qr_image = data.get('qr_image')
        token_text = data.get('token_text')

        if not chat_id or not qr_image: return jsonify({'success': False, 'message': 'Chat ID/Gambar kosong'}), 400

        caption = f"🔐 *SECURE QR TOKEN*\n\nSalin token ini:\n`{token_text}`\n\n_Generated by Secure Vault App_"
        result = send_telegram_photo(chat_id, qr_image, caption)

        if result.get("ok"): return jsonify({'success': True})
        else: return jsonify({'success': False, 'message': result.get("description")}), 500
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)