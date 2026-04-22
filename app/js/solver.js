// Port of the Python solver logic to plain JS.
// Mirrors game_state.py, eliminate_words.py, char_freq_ranker.py, eliminate_ranker.py.

class GameState {
    constructor(wordlist) {
        this.currentWordlist = wordlist.slice();
        this.knownLetters = [null, null, null, null, null];
        this.badLetters = new Set();
        this.yellowLetters = new Map(); // char -> Set<index>
    }

    clone() {
        const copy = Object.create(GameState.prototype);
        copy.currentWordlist = this.currentWordlist.slice();
        copy.knownLetters = this.knownLetters.slice();
        copy.badLetters = new Set(this.badLetters);
        copy.yellowLetters = new Map();
        for (const [ch, set] of this.yellowLetters) {
            copy.yellowLetters.set(ch, new Set(set));
        }
        return copy;
    }
}

// guessResult: Array<[char, 'b' | 'y' | 'g']>
function parseGuessResult(guessResult, gameState) {
    for (let i = 0; i < guessResult.length; i++) {
        const [ch, result] = guessResult[i];
        if (result === 'g') {
            gameState.knownLetters[i] = ch;
        } else if (result === 'b') {
            // Only mark as bad if we haven't seen this letter as green or yellow elsewhere
            const isKnown = gameState.knownLetters.some(kl => kl === ch);
            const isYellow = gameState.yellowLetters.has(ch);
            if (!isKnown && !isYellow) {
                gameState.badLetters.add(ch);
            }
        } else if (result === 'y') {
            if (!gameState.yellowLetters.has(ch)) {
                gameState.yellowLetters.set(ch, new Set());
            }
            gameState.yellowLetters.get(ch).add(i);
        }
    }
}

function testWord(word, gameState) {
    for (const ch of gameState.yellowLetters.keys()) {
        if (!word.includes(ch)) return false;
    }
    for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        if (gameState.badLetters.has(ch)) {
            return false;
        } else if (gameState.knownLetters[i] !== null) {
            if (gameState.knownLetters[i] !== ch) return false;
        } else if (gameState.yellowLetters.has(ch)) {
            if (gameState.yellowLetters.get(ch).has(i)) return false;
        }
    }
    return true;
}

function eliminate(gameState) {
    const result = [];
    for (const word of gameState.currentWordlist) {
        if (testWord(word, gameState)) result.push(word);
    }
    return result;
}

function getRemainingWords(guessResult, gameState) {
    parseGuessResult(guessResult, gameState);
    return eliminate(gameState);
}

// char_freq_ranker: score each word by the sum of per-letter frequencies (unique letters only).
function charFreqRanker(remainingWords) {
    const freq = new Map();
    for (const word of remainingWords) {
        for (const ch of word) {
            freq.set(ch, (freq.get(ch) || 0) + 1);
        }
    }
    const scores = [];
    for (const word of remainingWords) {
        let sum = 0;
        const seen = new Set();
        for (const ch of word) {
            if (!seen.has(ch)) {
                sum += freq.get(ch);
                seen.add(ch);
            }
        }
        scores.push([word, sum]);
    }
    scores.sort((a, b) => b[1] - a[1]);
    return scores;
}

function generateGuessResult(guessed, actual) {
    const result = new Array(guessed.length);
    for (let i = 0; i < guessed.length; i++) {
        if (guessed[i] === actual[i]) {
            result[i] = [guessed[i], 'g'];
        } else if (actual.includes(guessed[i])) {
            result[i] = [guessed[i], 'y'];
        } else {
            result[i] = [guessed[i], 'b'];
        }
    }
    return result;
}

// Average number of words eliminated if we guess `word` and the answer is any remaining word.
function testGuessWord(wordToGuess, remainingWords, gameState) {
    const size = remainingWords.length;
    let totalEliminated = 0;
    for (const target of remainingWords) {
        const copy = gameState.clone();
        const guessResult = generateGuessResult(wordToGuess, target);
        const rem = getRemainingWords(guessResult, copy);
        totalEliminated += (size - rem.length);
    }
    return Math.round((totalEliminated / size) * 100) / 100;
}

// Chunked async version of the eliminate ranker so the UI stays responsive.
// Calls onProgress(done, total) periodically. Resolves with sorted [word, score] pairs.
function eliminateRankerAsync(remainingWords, gameState, onProgress, chunkSize = 20) {
    return new Promise((resolve) => {
        const scores = [];
        let i = 0;
        const total = remainingWords.length;

        function step() {
            const end = Math.min(i + chunkSize, total);
            for (; i < end; i++) {
                const word = remainingWords[i];
                scores.push([word, testGuessWord(word, remainingWords, gameState)]);
            }
            if (onProgress) onProgress(i, total);
            if (i < total) {
                setTimeout(step, 0);
            } else {
                scores.sort((a, b) => b[1] - a[1]);
                resolve(scores);
            }
        }

        step();
    });
}

// Expose to the global scope for app.js.
window.WordleSolver = {
    GameState,
    getRemainingWords,
    charFreqRanker,
    eliminateRankerAsync,
};
