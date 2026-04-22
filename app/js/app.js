(function () {
    const { GameState, getRemainingWords, charFreqRanker, eliminateRankerAsync } = window.WordleSolver;

    const WORDLIST_URL = 'word_lists/corncob_5_letters.txt';
    const WORD_LENGTH = 5;
    const MAX_ROWS = 6;
    const ELIMINATE_THRESHOLD = 1500; // skip expensive ranker when remaining list is huge

    // Ranker results on the full starting wordlist never change, so they are hard-coded
    // here to avoid recomputing. Regenerate by running the Python solver on the
    // full word list.
    const INITIAL_CHAR_FREQ_TOP = [
        ['arose', 9170],
        ['earls', 9067],
        ['laser', 9067],
        ['reals', 9067],
        ['arise', 9027],
    ];

    const INITIAL_ELIMINATION_RANKER_TOP = [
        ['tares', 4175.68],
        ['rates', 4173.03],
        ['tales', 4171.28],
        ['saner', 4169.32],
        ['reals', 4169.12],
    ];


    const boardEl = document.getElementById('board');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const statusEl = document.getElementById('status');
    const remainingCountEl = document.getElementById('remaining-count');
    const remainingPreviewEl = document.getElementById('remaining-preview');
    const charFreqListEl = document.getElementById('char-freq-list');
    const eliminateListEl = document.getElementById('eliminate-list');
    const eliminateStatusEl = document.getElementById('eliminate-status');
    const taglineEl = document.getElementById('tagline');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const targetInputContainer = document.getElementById('target-input-container');
    const targetInput = document.getElementById('target-input');
    const targetSetBtn = document.getElementById('target-set-btn');

    const STATES = ['b', 'y', 'g']; // gray -> yellow -> green
    const state = {
        allWords: null,
        game: null,
        rowIndex: 0,
        rows: [], // { cells: [{el, letter, color}] }
        eliminateRunId: 0,
        mode: 'solver', // 'solver', 'play', or 'guess'
        targetWord: null, // for play and guess modes
    };

    function noGuessesYet() {
        const g = state.game;
        return g.knownLetters.every(c => c === null)
            && g.badLetters.size === 0
            && g.yellowLetters.size === 0;
    }

    function generateGuessResultFromTarget(guess, target) {
        const result = Array(WORD_LENGTH).fill('b');
        const targetLetters = target.split('');

        // First pass: mark greens and remove from available letters
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (guess[i] === targetLetters[i]) {
                result[i] = 'g';
                targetLetters[i] = null;
            }
        }

        // Second pass: mark yellows for remaining letters
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (result[i] === 'b') {
                const letterIndex = targetLetters.indexOf(guess[i]);
                if (letterIndex !== -1) {
                    result[i] = 'y';
                    targetLetters[letterIndex] = null;
                }
            }
        }

        return result.map((color, i) => [guess[i], color]);
    }

    function switchMode(newMode) {
        state.mode = newMode;
        state.targetWord = null;
        targetInput.value = '';

        modeButtons.forEach(btn => btn.classList.remove('active'));
        document.getElementById(`mode-${newMode}`).classList.add('active');

        if (newMode === 'solver') {
            taglineEl.textContent = 'Type a guess, click each letter to toggle its color, then submit.';
            targetInputContainer.style.display = 'none';
        } else if (newMode === 'play') {
            taglineEl.textContent = 'Guess the word! The solver will help you narrow it down.';
            targetInputContainer.style.display = 'none';
            selectRandomTarget();
        } else if (newMode === 'guess') {
            taglineEl.textContent = 'Enter a target word, then guess towards it with solver help.';
            targetInputContainer.style.display = 'block';
            targetInput.focus();
        }

        if (state.allWords) reset();
    }

    function selectRandomTarget() {
        const randomIdx = Math.floor(Math.random() * state.allWords.length);
        state.targetWord = state.allWords[randomIdx];
    }

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg || '';
        statusEl.classList.toggle('error', !!isError);
    }

    function createBoard() {
        boardEl.innerHTML = '';
        state.rows = [];
        for (let r = 0; r < MAX_ROWS; r++) {
            const rowEl = document.createElement('div');
            rowEl.className = 'row';
            const cells = [];
            for (let c = 0; c < WORD_LENGTH; c++) {
                const cellEl = document.createElement('div');
                cellEl.className = 'cell';
                cellEl.dataset.row = r;
                cellEl.dataset.col = c;
                rowEl.appendChild(cellEl);
                cells.push({ el: cellEl, letter: '', color: 'b' });
            }
            boardEl.appendChild(rowEl);
            state.rows.push({ el: rowEl, cells });
        }
        activateRow(0);
    }

    function activateRow(r) {
        state.rowIndex = r;
        state.rows.forEach((row, i) => row.el.classList.toggle('active', i === r));
        updateSubmitButton();
    }

    function currentRow() {
        return state.rows[state.rowIndex];
    }

    function renderCell(cell) {
        cell.el.textContent = cell.letter;
        cell.el.classList.toggle('filled', !!cell.letter);
        cell.el.classList.remove('state-b', 'state-y', 'state-g');
        if (cell.letter) cell.el.classList.add(`state-${cell.color}`);
    }

    function updateSubmitButton() {
        const row = currentRow();
        const filled = row && row.cells.every(c => c.letter);
        submitBtn.disabled = !filled || !state.allWords;
    }

    function onKeydown(e) {
        if (!state.allWords) return;
        if (state.rowIndex >= MAX_ROWS) return;
        // In guess mode, don't handle board input while typing in the target input
        if (state.mode === 'guess' && document.activeElement === targetInput) return;

        const row = currentRow();
        if (e.key === 'Enter') {
            if (!submitBtn.disabled) submitGuess();
            return;
        }
        if (e.key === 'Backspace') {
            for (let i = WORD_LENGTH - 1; i >= 0; i--) {
                if (row.cells[i].letter) {
                    row.cells[i].letter = '';
                    row.cells[i].color = 'b';
                    renderCell(row.cells[i]);
                    break;
                }
            }
            updateSubmitButton();
            return;
        }
        if (/^[a-zA-Z]$/.test(e.key)) {
            for (let i = 0; i < WORD_LENGTH; i++) {
                if (!row.cells[i].letter) {
                    row.cells[i].letter = e.key.toLowerCase();
                    row.cells[i].color = 'b';
                    renderCell(row.cells[i]);
                    break;
                }
            }
            updateSubmitButton();
        }
    }

    function onBoardClick(e) {
        const cellEl = e.target.closest('.cell');
        if (!cellEl) return;
        const r = Number(cellEl.dataset.row);
        const c = Number(cellEl.dataset.col);
        if (r !== state.rowIndex) return;
        const cell = state.rows[r].cells[c];
        if (!cell.letter) return;
        if (state.mode !== 'solver') return; // Only allow color cycling in solver mode
        const idx = STATES.indexOf(cell.color);
        cell.color = STATES[(idx + 1) % STATES.length];
        renderCell(cell);
    }

    function submitGuess() {
        const row = currentRow();
        const guess = row.cells.map(c => c.letter).join('');

        // In play/guess modes, auto-generate the result from target word
        let guessResult;
        if (state.mode === 'play' || state.mode === 'guess') {
            guessResult = generateGuessResultFromTarget(guess, state.targetWord);
            // Update board colors to show the result
            row.cells.forEach((cell, i) => {
                cell.color = guessResult[i][1];
                renderCell(cell);
            });
        } else {
            guessResult = row.cells.map(c => [c.letter, c.color]);
        }

        const remaining = getRemainingWords(guessResult, state.game);
        state.game.currentWordlist = remaining;

        renderSuggestions(remaining);

        const guessWord = guess;
        if (guessWord === state.targetWord && state.targetWord) {
            setStatus(`🎉 Correct! The word is "${state.targetWord}".`);
            submitBtn.disabled = true;
            return;
        }

        if (remaining.length === 0) {
            const msg = state.targetWord
                ? `No words match. Are you sure "${state.targetWord}" is correct?`
                : 'No words match these constraints. Check the colors you entered.';
            setStatus(msg, true);
            submitBtn.disabled = true;
            return;
        }

        if (state.rowIndex + 1 >= MAX_ROWS) {
            const msg = state.targetWord
                ? `Out of rows. The word was "${state.targetWord}".`
                : `Out of rows. ${remaining.length} words still possible.`;
            setStatus(msg);
            submitBtn.disabled = true;
            return;
        }

        activateRow(state.rowIndex + 1);
        setStatus(`${remaining.length} words remain.`);
    }

    function fillWordIntoBoard(word) {
        if (!state.allWords || state.rowIndex >= MAX_ROWS) return;
        const row = currentRow();
        if (!row) return;

        row.cells.forEach(cell => {
            cell.letter = '';
            cell.color = 'b';
            renderCell(cell);
        });

        for (let i = 0; i < word.length && i < WORD_LENGTH; i++) {
            row.cells[i].letter = word[i];
            row.cells[i].color = 'b';
            renderCell(row.cells[i]);
        }

        updateSubmitButton();
    }

    function renderList(el, scoredPairs, limit = 5) {
        el.innerHTML = '';
        scoredPairs.slice(0, limit).forEach(([word, score]) => {
            const li = document.createElement('li');
            li.innerHTML = `${word}<span class="score">${score}</span>`;
            li.style.cursor = 'pointer';
            li.addEventListener('click', () => fillWordIntoBoard(word));
            el.appendChild(li);
        });
        if (scoredPairs.length === 0) {
            const li = document.createElement('li');
            li.textContent = '—';
            el.appendChild(li);
        }
    }

    function renderRemainingPreview(words) {
        remainingPreviewEl.innerHTML = '';
        const PREVIEW = 60;
        words.slice(0, PREVIEW).forEach(w => {
            const li = document.createElement('li');
            li.textContent = w;
            remainingPreviewEl.appendChild(li);
        });
        if (words.length > PREVIEW) {
            const li = document.createElement('li');
            li.textContent = `+${words.length - PREVIEW} more`;
            remainingPreviewEl.appendChild(li);
        }
    }

    async function renderSuggestions(remaining) {
        remainingCountEl.textContent = remaining.length.toString();
        renderRemainingPreview(remaining);

        // Invalidate any in-flight eliminate ranker run.
        state.eliminateRunId += 1;
        const runId = state.eliminateRunId;

        if (noGuessesYet()) {
            renderList(charFreqListEl, INITIAL_CHAR_FREQ_TOP);
            renderList(eliminateListEl, INITIAL_ELIMINATION_RANKER_TOP);
            eliminateStatusEl.textContent = '(pre-computed first guess)';
            return;
        }

        const freqScores = charFreqRanker(remaining);
        renderList(charFreqListEl, freqScores);

        if (remaining.length === 0) {
            eliminateStatusEl.textContent = '';
            renderList(eliminateListEl, []);
            return;
        }

        if (remaining.length > ELIMINATE_THRESHOLD) {
            eliminateStatusEl.textContent = `(skipped — ${remaining.length} words, too expensive)`;
            renderList(eliminateListEl, []);
            return;
        }

        eliminateStatusEl.textContent = `(computing 0/${remaining.length}...)`;
        renderList(eliminateListEl, []);

        const scores = await eliminateRankerAsync(
            remaining,
            state.game,
            (done, total) => {
                if (runId !== state.eliminateRunId) return;
                eliminateStatusEl.textContent = `(computing ${done}/${total}...)`;
            }
        );

        if (runId !== state.eliminateRunId) return; // superseded
        eliminateStatusEl.textContent = '';
        renderList(eliminateListEl, scores);
    }

    function reset() {
        state.game = new GameState(state.allWords);
        state.rowIndex = 0;
        createBoard();

        if (state.mode === 'play') {
            selectRandomTarget();
            setStatus('New game! Guess the word.');
            renderSuggestions(state.allWords);
        } else if (state.mode === 'guess') {
            state.targetWord = null;
            targetInputContainer.style.display = 'block';
            targetInput.value = '';
            targetInput.focus();
            setStatus('Enter a target word.');
            renderSuggestions(state.allWords);
        } else {
            setStatus(`${state.allWords.length} words loaded. Start with your opening guess.`);
            renderSuggestions(state.allWords);
        }
    }

    async function loadWordList() {
        setStatus('Loading word list...');
        try {
            const resp = await fetch(WORDLIST_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const text = await resp.text();
            const words = text
                .split(/\r?\n/)
                .map(w => w.trim().toLowerCase())
                .filter(w => w.length === WORD_LENGTH);
            if (words.length === 0) throw new Error('empty word list');
            state.allWords = words;
            reset();
        } catch (err) {
            setStatus(
                `Could not load word list (${err.message}). ` +
                `If you opened index.html directly, run a local server: ` +
                `python -m http.server  — then open http://localhost:8000/`,
                true
            );
        }
    }

    // Wire up.
    document.addEventListener('keydown', onKeydown);
    boardEl.addEventListener('click', onBoardClick);
    submitBtn.addEventListener('click', submitGuess);
    resetBtn.addEventListener('click', () => {
        if (state.allWords) reset();
    });

    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });

    targetSetBtn.addEventListener('click', () => {
        const word = targetInput.value.trim().toLowerCase();
        if (word.length !== WORD_LENGTH) {
            setStatus(`Please enter a 5-letter word.`, true);
            return;
        }
        if (!state.allWords.includes(word)) {
            setStatus(`"${word}" is not in the word list.`, true);
            return;
        }
        state.targetWord = word;
        state.game = new GameState(state.allWords);
        state.rowIndex = 0;
        createBoard();
        targetInputContainer.style.display = 'none';
        setStatus(`Target set to "${word}". Start guessing!`);
        renderSuggestions(state.allWords);
    });

    targetInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') targetSetBtn.click();
    });

    loadWordList();
})();
