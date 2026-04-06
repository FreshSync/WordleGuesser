// ===== Precomputed first-guess rankings (with alpha=0.26 weighting) =====
const FIRST_GUESS_DATA = [
  { word: "tares", entropy: 6.19 },
  { word: "lares", entropy: 6.16 },
  { word: "rales", entropy: 6.11 },
  { word: "rates", entropy: 6.1 },
  { word: "teras", entropy: 6.08 },
  { word: "nares", entropy: 6.07 },
  { word: "soare", entropy: 6.06 },
  { word: "tales", entropy: 6.05 },
  { word: "reais", entropy: 6.05 },
  { word: "tears", entropy: 6.03 },
  { word: "arles", entropy: 6.03 },
  { word: "tores", entropy: 6.02 },
  { word: "salet", entropy: 6.02 },
  { word: "aeros", entropy: 6.01 },
  { word: "dares", entropy: 6.01 },
];

// ===== State =====
let solver = null;
let currentWord = "";
let allEntropies = [];
let visibleCount = 5;
let coloringMode = false;
let isFirstGuess = true;

// ===== DOM =====
const tilesRow = document.getElementById("tiles-row");
const tiles = tilesRow.querySelectorAll(".tile");
const submitBtn = document.getElementById("submit-btn");
const keyboard = document.getElementById("keyboard");
const historyEl = document.getElementById("history");
const suggestionsList = document.getElementById("suggestions-list");
const seeMoreBtn = document.getElementById("see-more-btn");
const guessNumberEl = document.getElementById("guess-number");
const candidatesCountEl = document.getElementById("candidates-count");
const loadingOverlay = document.getElementById("loading-overlay");
const solvedOverlay = document.getElementById("solved-overlay");
const solvedText = document.getElementById("solved-text");
const resetBtn = document.getElementById("reset-btn");
const inputInstruction = document.getElementById("input-instruction");
const inputSection = document.getElementById("input-section");
const colorLegend = document.getElementById("color-legend");

// ===== Init =====
async function init() {
  showLoading("Loading word list...");

  try {
    // Load words and frequencies in parallel
    const [wordsResp, freqResp] = await Promise.all([
      fetch("valid-wordle-words.txt"),
      fetch("word-frequencies.json"),
    ]);

    const wordsText = await wordsResp.text();
    const words = wordsText
      .trim()
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length === 5 && /^[a-z]+$/.test(w));

    if (words.length === 0) throw new Error("Empty word list");

    let frequencies = {};
    try {
      frequencies = await freqResp.json();
    } catch (e) {
      console.warn(
        "Could not load word-frequencies.json, falling back to pure entropy.",
      );
    }

    solver = new WordleSolver(words, frequencies);
    candidatesCountEl.textContent = solver.getCandidateCount();

    // Use precomputed data for first guess
    isFirstGuess = true;
    allEntropies = FIRST_GUESS_DATA;
    visibleCount = 5;
    renderSuggestions();
    hideLoading();
  } catch (e) {
    hideLoading();
    alert(
      "Could not load files. Make sure valid-wordle-words.txt and word-frequencies.json are in the same folder as index.html.",
    );
    console.error(e);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ===== Tiles =====
function updateTiles() {
  tiles.forEach((tile, i) => {
    if (i < currentWord.length) {
      tile.textContent = currentWord[i];
      tile.classList.add("filled");
    } else {
      tile.textContent = "";
      tile.classList.remove("filled", "colored");
      tile.setAttribute("data-color", "gray");
    }

    tile.classList.toggle(
      "active",
      !coloringMode && i === currentWord.length && currentWord.length < 5,
    );
  });

  if (currentWord.length === 5 && !coloringMode) {
    coloringMode = true;
    colorLegend.style.display = "flex";
    inputInstruction.textContent = "Tap each tile to set its color";
    tiles.forEach((tile) => {
      tile.classList.add("colored");
      tile.setAttribute("data-color", "gray");
      tile.classList.remove("active");
    });
  }

  if (currentWord.length < 5 && coloringMode) {
    coloringMode = false;
    colorLegend.style.display = "none";
    inputInstruction.textContent = "Type a word or pick one below";
  }

  submitBtn.disabled = !coloringMode;
}

function cycleTileColor(index) {
  if (!coloringMode || index >= currentWord.length) return;

  const tile = tiles[index];
  const current = tile.getAttribute("data-color");
  const order = ["gray", "yellow", "green"];
  tile.setAttribute("data-color", order[(order.indexOf(current) + 1) % 3]);

  tile.style.transform = "scale(1.1)";
  setTimeout(() => (tile.style.transform = ""), 100);
}

tiles.forEach((tile, i) => {
  tile.addEventListener("click", () => cycleTileColor(i));
});

// ===== Keyboard =====
keyboard.addEventListener("click", (e) => {
  const key = e.target.closest(".key");
  if (!key) return;
  handleKey(key.dataset.key);
});

document.addEventListener("keydown", (e) => {
  if (solvedOverlay.style.display !== "none") return;
  if (loadingOverlay.style.display !== "none") return;

  if (e.key === "Backspace") {
    e.preventDefault();
    handleKey("BACKSPACE");
  } else if (e.key === "Enter") {
    e.preventDefault();
    handleKey("ENTER");
  } else if (/^[a-zA-Z]$/.test(e.key)) {
    handleKey(e.key.toUpperCase());
  }
});

function handleKey(key) {
  if (key === "BACKSPACE") {
    if (currentWord.length > 0) {
      currentWord = currentWord.slice(0, -1);
      updateTiles();
    }
  } else if (key === "ENTER") {
    if (coloringMode) handleSubmit();
  } else if (!coloringMode && currentWord.length < 5 && key.length === 1) {
    currentWord += key.toLowerCase();
    updateTiles();
  }
}

// ===== Submit =====
submitBtn.addEventListener("click", handleSubmit);

async function handleSubmit() {
  if (!coloringMode) return;

  const pattern = [];
  for (let i = 0; i < 5; i++) {
    const color = tiles[i].getAttribute("data-color");
    pattern.push(color === "green" ? 2 : color === "yellow" ? 1 : 0);
  }

  addHistoryRow(currentWord, pattern);

  if (pattern.every((p) => p === 2)) {
    showSolved(currentWord, solver.guessNumber);
    return;
  }

  if (solver.guessNumber >= 6) {
    resetInput();
    inputInstruction.textContent = "Out of guesses!";
    suggestionsList.innerHTML =
      '<p class="no-results">No more guesses available.</p>';
    seeMoreBtn.style.display = "none";
    return;
  }

  showLoading("Filtering...");
  await delay(30);

  solver.filterCandidates(currentWord, pattern);
  isFirstGuess = false;
  guessNumberEl.textContent = solver.guessNumber;
  candidatesCountEl.textContent = solver.getCandidateCount();

  if (solver.getCandidateCount() === 0) {
    hideLoading();
    resetInput();
    suggestionsList.innerHTML =
      '<p class="no-results">No matching words found. The word may not be in the dictionary.</p>';
    seeMoreBtn.style.display = "none";
    return;
  }

  if (solver.getCandidateCount() === 1) {
    hideLoading();
    allEntropies = [{ word: solver.candidates[0], entropy: 0 }];
    visibleCount = 5;
    renderSuggestions();
    resetInput();
    inputInstruction.textContent = "Only one word left!";
    return;
  }

  showLoading("Computing entropies...");
  await delay(30);

  allEntropies = solver.computeEntropies();
  visibleCount = 5;
  renderSuggestions();
  hideLoading();
  resetInput();
}

function resetInput() {
  currentWord = "";
  coloringMode = false;
  colorLegend.style.display = "none";
  tiles.forEach((tile) => {
    tile.textContent = "";
    tile.classList.remove("filled", "colored", "active");
    tile.setAttribute("data-color", "gray");
  });
  submitBtn.disabled = true;
  inputInstruction.textContent = "Type a word or pick one below";
}

// ===== History =====
function addHistoryRow(word, pattern) {
  const row = document.createElement("div");
  row.className = "history-row";

  const colorMap = { 2: "green", 1: "yellow", 0: "gray" };

  for (let i = 0; i < 5; i++) {
    const tile = document.createElement("div");
    tile.className = "history-tile " + colorMap[pattern[i]];
    tile.textContent = word[i];
    row.appendChild(tile);
  }

  historyEl.appendChild(row);
}

// ===== Suggestions =====
function renderSuggestions() {
  suggestionsList.innerHTML = "";

  const n = solver.getCandidateCount();
  const toShow = allEntropies.slice(0, visibleCount);

  // Find max Zipf among visible for bar scaling (max possible is ~7)
  const MAX_ZIPF = 7;

  toShow.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "suggestion";

    const expectedRemaining =
      item.entropy > 0
        ? Math.round(n / Math.pow(2, item.entropy))
        : n === 1
          ? 1
          : 0;
    const remainingText =
      expectedRemaining <= 1 ? "~1 left" : "~" + expectedRemaining + " left";

    const zipf = (solver.frequencies && solver.frequencies[item.word]) || 0;
    const barPercent = Math.min((zipf / MAX_ZIPF) * 100, 100);

    el.innerHTML =
      '<div class="suggestion-top">' +
      '<span class="suggestion-rank">' +
      (i + 1) +
      "</span>" +
      '<span class="suggestion-word">' +
      item.word +
      "</span>" +
      '<span class="suggestion-stat">' +
      remainingText +
      "</span>" +
      "</div>" +
      '<div class="suggestion-bottom">' +
      '<span class="suggestion-pop-label">Popularity</span>' +
      '<div class="suggestion-pop-track">' +
      '<div class="suggestion-pop-fill" style="width:' +
      barPercent +
      '%"></div>' +
      "</div>" +
      "</div>";

    el.addEventListener("click", () => {
      currentWord = item.word.toLowerCase();
      updateTiles();
      tilesRow.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    suggestionsList.appendChild(el);
  });

  const remaining = allEntropies.length - visibleCount;
  if (remaining > 0) {
    seeMoreBtn.style.display = "block";
    seeMoreBtn.textContent = "Show " + Math.min(10, remaining) + " more";
  } else {
    seeMoreBtn.style.display = "none";
  }
}

seeMoreBtn.addEventListener("click", () => {
  visibleCount += 10;
  renderSuggestions();
});

// ===== Loading =====
function showLoading(text) {
  loadingOverlay.querySelector(".loading-text").textContent =
    text || "Computing...";
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

// ===== Solved =====
function showSolved(word, guessNum) {
  solvedText.textContent =
    word.toUpperCase() +
    " in " +
    guessNum +
    (guessNum === 1 ? " guess" : " guesses");
  solvedOverlay.style.display = "flex";
  inputSection.style.display = "none";
}

resetBtn.addEventListener("click", () => {
  solver.reset();
  solvedOverlay.style.display = "none";
  inputSection.style.display = "block";
  historyEl.innerHTML = "";
  guessNumberEl.textContent = "1";
  candidatesCountEl.textContent = solver.getCandidateCount();
  resetInput();

  isFirstGuess = true;
  allEntropies = FIRST_GUESS_DATA;
  visibleCount = 5;
  renderSuggestions();
});

// ===== Boot =====
init();
