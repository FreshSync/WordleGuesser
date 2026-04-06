const ALPHA = 0.26;

class WordleSolver {
  constructor(words, frequencies) {
    this.allWords = words;
    this.frequencies = frequencies || {};
    this.candidates = [...words];
    this.guessNumber = 1;
  }

  reset() {
    this.candidates = [...this.allWords];
    this.guessNumber = 1;
  }

  getPattern(guess, answer) {
    const pattern = [0, 0, 0, 0, 0];
    const remaining = answer.split("");

    for (let i = 0; i < 5; i++) {
      if (guess[i] === answer[i]) {
        pattern[i] = 2;
        remaining[i] = null;
      }
    }

    for (let i = 0; i < 5; i++) {
      if (pattern[i] === 2) continue;
      const idx = remaining.indexOf(guess[i]);
      if (idx !== -1) {
        pattern[i] = 1;
        remaining[idx] = null;
      }
    }

    return pattern;
  }

  patternToKey(pattern) {
    return (
      pattern[0] * 81 +
      pattern[1] * 27 +
      pattern[2] * 9 +
      pattern[3] * 3 +
      pattern[4]
    );
  }

  computeEntropies() {
    const n = this.candidates.length;
    if (n === 0) return [];
    if (n === 1) return [{ word: this.candidates[0], entropy: 0, score: 1 }];

    // Compute raw entropies
    const entropies = [];
    for (let i = 0; i < n; i++) {
      const guess = this.candidates[i];
      const counts = new Map();

      for (let j = 0; j < n; j++) {
        const pattern = this.getPattern(guess, this.candidates[j]);
        const key = this.patternToKey(pattern);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      let entropy = 0;
      for (const count of counts.values()) {
        const p = count / n;
        entropy -= p * Math.log2(p);
      }

      entropies.push({ word: guess, entropy });
    }

    // Normalize entropy to [0, 1]
    let maxEntropy = 0;
    for (const e of entropies) {
      if (e.entropy > maxEntropy) maxEntropy = e.entropy;
    }
    if (maxEntropy === 0) maxEntropy = 1;

    // Normalize frequency to [0, 1]
    let maxFreq = 0;
    for (const e of entropies) {
      const f = this.frequencies[e.word] || 0;
      if (f > maxFreq) maxFreq = f;
    }
    if (maxFreq === 0) maxFreq = 1;

    // Compute combined score
    for (const e of entropies) {
      const normEntropy = e.entropy / maxEntropy;
      const normFreq = (this.frequencies[e.word] || 0) / maxFreq;
      e.score = (1 - ALPHA) * normEntropy + ALPHA * normFreq;
    }

    // Sort by combined score descending
    entropies.sort((a, b) => b.score - a.score);
    return entropies;
  }

  filterCandidates(guess, pattern) {
    this.candidates = this.candidates.filter((word) => {
      const actual = this.getPattern(guess, word);
      for (let i = 0; i < 5; i++) {
        if (actual[i] !== pattern[i]) return false;
      }
      return true;
    });
    this.guessNumber++;
  }

  getCandidateCount() {
    return this.candidates.length;
  }
}
