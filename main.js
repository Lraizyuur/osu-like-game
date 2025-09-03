// 曲リスト
const chartsList = [
  { name: "Xenosphere", file: "charts/song1.json" },
  { name: "愛ト茄子ト平和ナ果実", file: "charts/song2.json" },
];

// canvas準備 
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let musicBuffer = null;
let hitBuffer = null;
let musicSource = null;

// グローバル状態
let notes = [];
let startTime = 0;
let running = false;
let score = 0;
let lastJudge = "-";
let stats = { perfect: 0, good: 0, bad: 0, miss: 0 };

// 判定設定（ms）
const JUDGE = { perfect: 50, good: 120, bad: 200, miss: 200 };
// 視覚設定
const HIT_RADIUS = 45;
const APPROACH_TIME = 1000;
const MAX_APPROACH_RADIUS = 180;

// UI要素
const selectEl = document.getElementById("chartSelect");  
const startBtn = document.getElementById("startBtn");
const menuEl = document.getElementById("menu");
const hudScore = document.getElementById("score");
const hudJudge = document.getElementById("judge");
const resultEl = document.getElementById("result");

// 時間基準（Web Audio API の clock）
function getNow() {
  return (audioContext.currentTime - startTime) * 1000;
}

// 効果音を読み込み
/*
fetch("sounds/maou_se_system14.mp3")
  .then(res => res.arrayBuffer())
  .then(data => audioContext.decodeAudioData(data))
  .then(buffer => { hitBuffer = buffer; })
  .catch(err => console.error("効果音読み込み失敗:", err));
*/

// ランキング管理 
function loadRanking() {
  const raw = localStorage.getItem("ranking");
  return raw ? JSON.parse(raw) : [];
}

function saveRanking(ranking) {
  localStorage.setItem("ranking", JSON.stringify(ranking));
}

function addRanking(score) {
  let ranking = loadRanking();
  ranking.push(score);
  ranking.sort((a, b) => b - a); // 降順
  if (ranking.length > 5) ranking = ranking.slice(0, 5);
  saveRanking(ranking);
  return ranking;
}


// 判定成功時に呼ぶ関数（低遅延再生）
function playHitSound() {
  if (!hitBuffer) return;
  const source = audioContext.createBufferSource();
  source.buffer = hitBuffer;
  source.connect(audioContext.destination);
  source.start();
}

// populate select
document.addEventListener("DOMContentLoaded", () => {
  chartsList.forEach(ch => {
    const o = document.createElement("option");
    o.value = ch.file;
    o.textContent = ch.name;
    selectEl.appendChild(o);
  });
});

startBtn.addEventListener("click", () => {
  const file = selectEl.value;
  startGame(file);
});

// 曲の読み込み
async function loadMusic(url) {
  const res = await fetch(url);
  const data = await res.arrayBuffer();
  musicBuffer = await audioContext.decodeAudioData(data);
}

// 曲の再生
function playMusic() {
  musicSource = audioContext.createBufferSource();
  musicSource.buffer = musicBuffer;
  musicSource.connect(audioContext.destination);
  musicSource.start();
  startTime = audioContext.currentTime;
  musicSource.onended = () => endGame();
}

// startGame: 譜面読み込み -> 再生 -> update開始
async function startGame(chartFile) {
  try {
    const r = await fetch(chartFile);
    if (!r.ok) throw new Error("譜面読み込みに失敗しました");
    const chart = await r.json();

    // notes を初期化
    notes = chart.notes.map(n => ({ ...n, hit: false }));
    score = 0;
    lastJudge = "-";
    stats = { perfect: 0, good: 0, bad: 0, miss: 0 };
    hudScore.textContent = "Score: 0";
    hudJudge.textContent = "Judge: -";

    // UI切替
    menuEl.style.display = "none";
    resultEl.classList.add("hidden");

    // 曲読み込み & 再生
    await loadMusic(chart.audio);
    playMusic();

    running = true;
    requestAnimationFrame(update);
  } catch (e) {
    console.error(e);
    alert("譜面ロードに失敗しました: " + e.message);
  }
}

// update (描画ループ)
function update() {
  if (!running) return;

  const now = getNow();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let note of notes) {
    const dt = note.time - now;

    if (!note.hit && dt < -JUDGE.miss) {
      note.hit = true;
      stats.miss++;
    }

    if (!note.hit && dt < APPROACH_TIME) {
      const t = Math.max(0, dt);
      const radius = HIT_RADIUS + (t / APPROACH_TIME) * (MAX_APPROACH_RADIUS - HIT_RADIUS);

      ctx.beginPath();
      ctx.arc(note.x, note.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,200,255,0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(note.x, note.y, HIT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.stroke();
    }
  }

  hudScore.textContent = "Score: " + score;
  hudJudge.textContent = "Judge: " + lastJudge;

  requestAnimationFrame(update);
}

// クリック判定
canvas.addEventListener("click", (e) => {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const now = getNow();

  let best = null;
  let bestDelta = Infinity;
  for (let note of notes) {
    if (note.hit) continue;
    const delta = Math.abs(note.time - now);
    if (delta <= JUDGE.miss) {
      const dx = mx - note.x;
      const dy = my - note.y;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        if (delta < bestDelta) {
          best = note;
          bestDelta = delta;
        }
      }
    }
  }

  if (best) {
    best.hit = true;
    if (bestDelta < JUDGE.perfect) {
      score += 300;
      lastJudge = "Perfect";
      stats.perfect++;
    } else if (bestDelta < JUDGE.good) {
      score += 100;
      lastJudge = "Good";
      stats.good++;
    } else {
      score += 50;
      lastJudge = "Bad";
      stats.bad++;
    }
    playHitSound();
  }
});

// 終了処理
/*
function endGame() {
  running = false;
  resultEl.innerHTML = `
    <h2>Result</h2>
    <p>Score: ${score}</p>
    <p>Perfect: ${stats.perfect} / Good: ${stats.good} / Bad: ${stats.bad} / Miss: ${stats.miss}</p>
    <button id="backBtn">曲選択に戻る</button>
  `;
  resultEl.classList.remove("hidden");
  menuEl.style.display = "block";

  document.getElementById("backBtn").addEventListener("click", () => {
    notes = [];
    musicSource = null;
    score = 0;
    lastJudge = "-";
    resultEl.classList.add("hidden");
    hudScore.textContent = "Score: 0";
    hudJudge.textContent = "Judge: -";
  });
}
*/

function endGame() {
  running = false;

  // スコアをランキングに追加
  const ranking = addRanking(score);

  // 結果画面HTML生成
  resultEl.innerHTML = `
    <h2>Result</h2>
    <p>Score: ${score}</p>
    <p>Perfect: ${stats.perfect} / Good: ${stats.good} / Bad: ${stats.bad} / Miss: ${stats.miss}</p>
    <h3>Ranking</h3>
    <ol>
      ${ranking.map(s => `<li>${s}</li>`).join("")}
    </ol>
    <button id="backBtn">曲選択に戻る</button>
  `;

  resultEl.classList.remove("hidden");
  menuEl.style.display = "block";

  document.getElementById("backBtn").addEventListener("click", () => {
    notes = [];
    musicSource = null;
    score = 0;
    lastJudge = "-";
    resultEl.classList.add("hidden");
    hudScore.textContent = "Score: 0";
    hudJudge.textContent = "Judge: -";
  });
}

