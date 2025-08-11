// --- 曲リスト（ここに作る譜面ファイルを追加していく） ---
const chartsList = [
  { name: "Xenosphere", file: "charts/song1.json" },
  { name: "Demo Song 2", file: "charts/song2.json" },
  // 後で5つくらい追加してください
];

// --- canvas準備 ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- グローバル状態 ---
let notes = [];
let startTime = 0;
let audio = null;
let running = false;
let score = 0;
let lastJudge = "-";
let stats = { perfect: 0, good: 0, bad: 0, miss: 0 };

// 判定設定（ms）
const JUDGE = { perfect: 50, good: 120, bad: 200, miss: 200 };
// 視覚設定
const HIT_RADIUS = 45; // ヒット判定半径（px）
const APPROACH_TIME = 1000; // ノーツが出現する先行時間（ms）
const MAX_APPROACH_RADIUS = 180; // アプローチサークルの最大半径（px）

// --- UI要素 ---
const selectEl = document.getElementById("chartSelect");  
const startBtn = document.getElementById("startBtn");
const menuEl = document.getElementById("menu");
const hudScore = document.getElementById("score");
const hudJudge = document.getElementById("judge");
const resultEl = document.getElementById("result");

// --- Web Audio API: ヒット音準備 ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let hitBuffer = null;

// 効果音を読み込み
fetch("sounds/maou_se_system14.mp3")
    .then(res => res.arrayBuffer())
    .then(data => audioContext.decodeAudioData(data))
    .then(buffer => {
        hitBuffer = buffer;
    })
    .catch(err => console.error("効果音読み込み失敗:", err));

// 判定成功時に呼ぶ関数（低遅延再生）
function playHitSound() {
    if (!hitBuffer) return; // 読み込み中はスキップ
    const source = audioContext.createBufferSource();
    source.buffer = hitBuffer;
    source.connect(audioContext.destination);
    source.start(0);
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

// startボタン
startBtn.addEventListener("click", () => {
  const file = selectEl.value;
  startGame(file);
});

// startGame: 譜面読み込み -> 再生 -> update開始
function startGame(chartFile) {
  fetch(chartFile)
    .then((r) => {
      if (!r.ok) throw new Error("譜面読み込みに失敗しました");
      return r.json();
    })
    .then((chart) => {
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

      // audio
      audio = new Audio(chart.audio);
      // ユーザー操作直後に呼ばれているので再生は許可されるはず
      audio.play().catch((e) => {
        console.warn("audio.play() failed:", e);
      });

      // onended で終了処理
      audio.onended = () => {
        endGame();
      };

      startTime = performance.now();
      running = true;
      requestAnimationFrame(update);
    })
    .catch((e) => {
      console.error(e);
      alert("譜面ロードに失敗しました: " + e.message);
    });
}

// update (描画ループ)
function update() {
  if (!running) return;

  const now = performance.now() - startTime; // ms

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 背景グリッド（任意）
  // draw notes
  for (let note of notes) {
    const dt = note.time - now; // 正ならヒットまでの時間(ms)
    // Miss判定
    if (!note.hit && dt < -JUDGE.miss) {
      note.hit = true;
      stats.miss++;
    }

    // 表示：approach時間内だけ描く
    if (!note.hit && dt < APPROACH_TIME) {
      const t = Math.max(0, dt); // 0..APPROACH_TIME
      const radius = HIT_RADIUS + (t / APPROACH_TIME) * (MAX_APPROACH_RADIUS - HIT_RADIUS);

      // アプローチサークル（外側の枠）
      ctx.beginPath();
      ctx.arc(note.x, note.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,200,255,0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // 中央のターゲット（薄い塗り）
      ctx.beginPath();
      ctx.arc(note.x, note.y, HIT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.stroke();
    }
  }

  // HUD 更新
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
  const now = performance.now() - startTime;

  // 最もヒットに近いノーツを選ぶ（優先順位）
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
    const delta = bestDelta;
    if (delta < JUDGE.perfect) {
      score += 300;
      lastJudge = "Perfect";
      stats.perfect++;
    } else if (delta < JUDGE.good) {
      score += 100;
      lastJudge = "Good";
      stats.good++;
    } else {
      score += 50;
      lastJudge = "Bad";
      stats.bad++;
    }
    // （任意）ヒット音やエフェクトをここで鳴らしたり表示したりする
    playHitSound();
  }
});

// 終了処理
function endGame() {
  running = false;
  // 最終スコア表示
  resultEl.innerHTML = `
    <h2>Result</h2>
    <p>Score: ${score}</p>
    <p>Perfect: ${stats.perfect} / Good: ${stats.good} / Bad: ${stats.bad} / Miss: ${stats.miss}</p>
    <button id="backBtn">曲選択に戻る</button>
  `;
  resultEl.classList.remove("hidden");
  menuEl.style.display = "block";

  document.getElementById("backBtn").addEventListener("click", () => {
    // reset
    notes = [];
    audio = null;
    score = 0;
    lastJudge = "-";
    resultEl.classList.add("hidden");
    hudScore.textContent = "Score: 0";
    hudJudge.textContent = "Judge: -";
  });
}
