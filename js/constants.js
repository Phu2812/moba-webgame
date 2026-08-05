// =============================================
// HẰNG SỐ GAME
// =============================================
const GAME_WIDTH    = 1600;
const GAME_HEIGHT   = 900;
const LANE_TOP      = 330;
const LANE_BOTTOM   = 570;
const MAX_ITEMS     = 3;    // Giới hạn kho đồ 3 món
const SHRINE_HEAL_RATE = 80; // HP/giây khi đứng trong Tế Đàn
const SELL_RATIO    = 0.6;  // Bán lại được 60% giá gốc

// =============================================
// DANH SÁCH TRANG BỊ CỬA HÀNG
// =============================================
const SHOP_ITEMS = [
    { id: 'sword1', name: '⚔️ Kiếm Ngắn',      price: 250,  desc: '+25 Sát thương vật lý',                    stats: { atkDmg: 25 } },
    { id: 'boots',  name: '👢 Giày Tốc Độ',     price: 300,  desc: '+1.0 Tốc chạy, giảm 0.1s hồi đòn đánh',  stats: { speed: 1.0, atkCdReduce: 0.1 } },
    { id: 'armor1', name: '🛡️ Áo Giáp Thép',   price: 400,  desc: '+350 Máu tối đa, hồi máu +4/s',           stats: { maxHp: 350, hpRegen: 4 } },
    { id: 'bow',    name: '🏹 Cung Chớp Nháy',  price: 750,  desc: '+45 Sát thương, giảm 0.2s hồi đòn đánh', stats: { atkDmg: 45, atkCdReduce: 0.2 } },
    { id: 'hammer', name: '🔨 Búa Bão Tố',      price: 1200, desc: '+85 Sát thương, +600 Máu tối đa',         stats: { atkDmg: 85, maxHp: 600 } }
];

// =============================================
// AUDIO
// =============================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'skill') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}
