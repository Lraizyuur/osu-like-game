const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const btnPlayPause = document.getElementById("btnPlayPause");
const btnExport = document.getElementById("btnExport");
const notesList = document.getElementById("notesList");

const audio = new Audio("charts/愛ト茄子ト平和ナ果実_saiB_202509020957.mp3");
let playing = false;

let notes = [];

btnPlayPause.addEventListener("click", () => {
  if (playing) {
    audio.pause();
    playing = false;
  } else {
    audio.play();
    playing = true;
  }
});

btnExport.addEventListener("click", () => {
  const exportData = {
    title: "自作譜面",
    audio: "charts/Xenosphere_inst.mp3",
    notes: notes.map(n => ({ time: n.time, x: n.x, y: n.y }))
  };
  notesList.textContent = JSON.stringify(exportData, null, 2);
  console.log(exportData);
  alert("コンソールと画面にJSONを出力しました。");
});

canvas.addEventListener("click", (e) => {
  if (!playing) return; // 再生中のみ記録可能

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const time = audio.currentTime * 1000; // ms

  notes.push({ time, x, y });
  updateNotesList();
});

function updateNotesList() {
  notesList.textContent = notes.map((n, i) => `${i+1}: time=${n.time.toFixed(0)}ms, x=${n.x.toFixed(0)}, y=${n.y.toFixed(0)}`).join("\n");
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 座標表示用の円を描く
  for (const note of notes) {
    ctx.beginPath();
    ctx.arc(note.x, note.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "cyan";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.stroke();
  }

  // 再生位置バー
  if (playing) {
    const progress = audio.currentTime / audio.duration;
    const barX = progress * canvas.width;
    ctx.beginPath();
    ctx.moveTo(barX, 0);
    ctx.lineTo(barX, canvas.height);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  requestAnimationFrame(draw);
}

draw();
