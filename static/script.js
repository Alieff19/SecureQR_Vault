// Inisialisasi Icon Lucide
lucide.createIcons();

// Variabel Global
let currentMode = 'encrypt';
let selectedFile = null;
let scanner = null;

// Logika keamanan sederhana, PIN berubah sesuai jam sistem (Jam+Menit)
let currentPinInput = "";

function getDynamicPin() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return hours + minutes; 
}

function pressKey(key) {
    if (key === 'back') currentPinInput = currentPinInput.slice(0, -1);
    else if (currentPinInput.length < 4) currentPinInput += key;
    updatePinDots();
    checkPin();
}

function updatePinDots() {
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (i <= currentPinInput.length) dot.classList.add('active');
        else dot.classList.remove('active');
    }
}

function checkPin() {
    if (currentPinInput.length === 4) {
        const correctPin = getDynamicPin();
        const card = document.getElementById('pin-card');
        
        if (currentPinInput === correctPin) {
            // PIN Benar: Hilangkan Overlay
            const overlay = document.getElementById('pin-overlay');
            overlay.classList.remove('visible-overlay');
            overlay.classList.add('hidden-overlay');
            setTimeout(() => { currentPinInput = ""; updatePinDots(); }, 500);
        } else {
            // PIN Salah: Efek Getar (Shake)
            card.classList.add('shake-anim'); 
            setTimeout(() => {
                card.classList.remove('shake-anim');
                currentPinInput = ""; updatePinDots();
            }, 400);
        }
    }
}

function doLogout() {
    const overlay = document.getElementById('pin-overlay');
    resetForm(true); 
    resetForm(false);
    overlay.classList.remove('hidden-overlay');
    overlay.classList.add('visible-overlay');
}

// === 2. LOGIKA APLIKASI ===

// Handler Input File
document.getElementById('fileInput').addEventListener('change', (e) => {
    if(e.target.files[0]) {
        selectedFile = e.target.files[0];
        document.getElementById('fileNameLabel').innerText = selectedFile.name;
        document.getElementById('fileNameLabel').className = "text-sm text-cyan-300 font-bold break-all";
        document.getElementById('input-text').disabled = true;
        document.getElementById('input-text').placeholder = "[MODE FILE AKTIF]";
        document.getElementById('input-text').value = "";
    }
});

// Fungsi Ganti Mode (Encrypt <-> Decrypt)
function setMode(mode) {
    currentMode = mode;
    const isEnc = mode === 'encrypt';
    
    // Ubah Style Panel
    document.getElementById('input-panel').className = isEnc ? "glass rounded-2xl p-6 shadow-2xl" : "glass rounded-2xl p-6 shadow-2xl glass-purple";
    
    // Ubah Judul & Icon
    document.getElementById('panel-title').innerHTML = isEnc ? '<i data-lucide="lock"></i> ENCRYPTION MODULE' : '<i data-lucide="unlock"></i> DECRYPTION MODULE';
    document.getElementById('panel-title').className = isEnc ? "text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2" : "text-xl font-bold text-purple-400 mb-6 flex items-center gap-2";
    
    // Toggle Visibility Form
    document.getElementById('form-encrypt').classList.toggle('hidden', !isEnc);
    document.getElementById('form-decrypt').classList.toggle('hidden', isEnc);
    document.getElementById('result-encrypt').classList.add('hidden');
    document.getElementById('result-decrypt').classList.add('hidden');
    document.getElementById('empty-state').classList.remove('hidden');
    
    // Update Style Tombol
    const activeClass = "px-6 py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] scale-105 flex gap-2 items-center";
    const inactiveClass = "px-6 py-3 rounded-xl font-bold transition-all bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 flex gap-2 items-center";
    const activeDecClass = "px-6 py-3 rounded-xl font-bold transition-all bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] scale-105 flex gap-2 items-center";
    
    document.getElementById('btn-encrypt').className = isEnc ? activeClass : inactiveClass;
    document.getElementById('btn-decrypt').className = !isEnc ? activeDecClass : inactiveClass;
    lucide.createIcons();
}

// === PROSES ENKRIPSI ===
async function processEncrypt() {
    const pwd = document.getElementById('input-pass-enc').value;
    if(!pwd) return alert("Password wajib!");
    
    setLoading(true);
    
    // Persiapkan Data (Text atau File)
    const fd = new FormData();
    fd.append('password', pwd);
    fd.append('expiry', document.getElementById('input-expiry').value);
    fd.append('max_scans', document.getElementById('input-scans').value);
    
    if(selectedFile) fd.append('file', selectedFile);
    else fd.append('text', document.getElementById('input-text').value);
    
    try {
        // Panggil API Backend
        const res = await fetch('/api/encrypt', {method:'POST', body:fd});
        const data = await res.json();
        setLoading(false);
        
        if(data.qr_image) {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('result-encrypt').classList.remove('hidden');
            document.getElementById('qr-image').src = data.qr_image;
            document.getElementById('raw-token').innerText = data.encrypted_data;
            resetForm(true);
        } else alert(data.error);
    } catch(e) { setLoading(false); alert(e); }
}

// === PROSES DEKRIPSI ===
async function processDecrypt() {
    const token = document.getElementById('input-token').value.trim();
    const pwd = document.getElementById('input-pass-dec').value;
    if(!token || !pwd) return alert("Data kurang!");
    
    setLoading(true); 
    await new Promise(r=>setTimeout(r,800)); // Delay estetika
    
    try {
        const res = await fetch('/api/decrypt', {
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({token, password:pwd})
        });
        const data = await res.json();
        setLoading(false);
        
        if(data.success) {
            document.getElementById('empty-state').classList.add('hidden');
            document.getElementById('result-decrypt').classList.remove('hidden');
            document.getElementById('meta-info').innerText = data.meta;
            const content = document.getElementById('decrypted-content');
            
            // Cek apakah hasil file atau text
            if(data.type === 'file') {
                // Tampilan jika Burn-After-Reading aktif
                let burnMsg = data.burned ? `<div class="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-3 animate-pulse"><i data-lucide="flame" class="text-red-400 w-6 h-6"></i><div><p class="text-red-300 text-xs font-bold font-mono">BURN-AFTER-READING TRIGGERED</p><p class="text-red-400/70 text-[10px]">File fisik di server telah dimusnahkan.</p></div></div>` : "";
                content.innerHTML = `<div class="text-center"><i data-lucide="file-check" class="w-16 h-16 text-green-400 mx-auto mb-2 drop-shadow-[0_0_10px_#4ade80]"></i><p class="text-green-300 font-bold mb-4 break-all text-sm">${data.file_name}</p><button onclick="downloadFile('${data.file_data}','${data.file_name}')" class="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg font-bold w-full flex justify-center gap-2 hover:brightness-110 transition-all shadow-lg"><i data-lucide="download" class="w-5 h-5"></i> DOWNLOAD FILE</button>${burnMsg}</div>`;
            } else {
                content.innerHTML = `<p class="font-mono text-green-300 text-sm whitespace-pre-wrap leading-relaxed">${data.message}</p>`;
            }
            lucide.createIcons(); 
            resetForm(false);
        } else alert("❌ GAGAL:\n" + data.message);
    } catch(e) { setLoading(false); alert(e); }
}

// === FUNGSI UTILITAS (Copy, Share, Telegram) ===
function copyToken() { 
    navigator.clipboard.writeText(document.getElementById('raw-token').innerText); 
    alert("Token Disalin!"); 
}

function shareToWhatsApp() {
    const token = document.getElementById('raw-token').innerText;
    if(!token || token==="...") return alert("Belum ada token!");
    window.open("https://wa.me/?text=" + encodeURIComponent("🔐 SECURE VAULT TOKEN:\n\n" + token), '_blank');
}

async function sendToTelegram() {
    const qr = document.getElementById('qr-image').src;
    const token = document.getElementById('raw-token').innerText;
    if(!qr) return alert("Belum ada QR!");
    
    const chatId = prompt("ID Telegram Penerima:");
    if(!chatId) return;
    
    const btn = document.getElementById('btn-telegram'); 
    const originalText = btn.innerHTML;
    btn.innerHTML = "SENDING..."; 
    btn.disabled = true;
    
    try {
        const res = await fetch('/api/send-telegram', {
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({chat_id:chatId, qr_image:qr, token_text:token})
        });
        const data = await res.json();
        if(data.success) alert("✅ Terkirim ke Telegram!"); else alert("❌ Gagal: " + data.message);
    } catch(e) { alert("Error: " + e); }
    
    btn.innerHTML = originalText; 
    btn.disabled = false; 
    lucide.createIcons();
}

// === FUNGSI KAMERA (HTML5-QRCODE) ===
function openCameraModal() { 
    document.getElementById('camera-modal').classList.remove('hidden'); 
    scanner = new Html5Qrcode("reader"); 
    scanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        (txt) => { 
            document.getElementById('input-token').value = txt; 
            closeCameraModal(); 
            document.getElementById('input-pass-dec').focus(); 
        }
    ).catch(e => { alert("Cam Error: " + e); closeCameraModal(); }); 
}

function closeCameraModal() { 
    document.getElementById('camera-modal').classList.add('hidden'); 
    if(scanner) scanner.stop().then(() => scanner.clear()); 
}

// Fungsi Download Helper
function downloadFile(b64,name) { 
    const a=document.createElement("a"); 
    a.href="data:application/octet-stream;base64,"+b64; 
    a.download=name; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
}

// UI Helpers
function setLoading(s) { 
    const l=document.getElementById('loading'); 
    s?l.classList.remove('hidden'):l.classList.add('hidden'); 
}

function resetForm(isEnc=true) { 
    if(isEnc) { 
        document.getElementById('input-pass-enc').value=""; 
        document.getElementById('input-text').value=""; 
        document.getElementById('fileInput').value=""; 
        selectedFile=null; 
        document.getElementById('fileNameLabel').innerText="Pilih File..."; 
        document.getElementById('fileNameLabel').className="text-sm text-slate-400 font-mono"; 
        document.getElementById('input-text').disabled=false; 
        document.getElementById('input-text').placeholder="Pesan rahasia..."; 
    } else { 
        document.getElementById('input-pass-dec').value=""; 
        document.getElementById('input-token').value=""; 
    } 
}

function openImageNewTab(){ 
    const img = document.getElementById('qr-image').src; 
    const w = window.open(""); 
    w.document.write('<body style="background:#000;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><img src="'+img+'" style="max-height:80vh;border:10px solid #fff"></body>'); 
}