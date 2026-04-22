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

    const STATES = ['b', 'y', 'g']; // gray -> yellow -> green
    const state = {
        allWords: null,
        game: null,
        rowIndex: 0,
        rows: [], // { cells: [{el, letter, color}] }
        eliminateRunId: 0,
    };

    function noGuessesYet() {
        const g = state.game;
        return g.knownLetters.every(c => c === null)
            && g.badLetters.size === 0
            && g.yellowLetters.size === 0;
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
        const idx = STATES.indexOf(cell.color);
        cell.color = STATES[(idx + 1) % STATES.length];
        renderCell(cell);
    }

    function submitGuess() {
        const row = currentRow();
        const guessResult = row.cells.map(c => [c.letter, c.color]);

        const remaining = getRemainingWords(guessResult, state.game);
        state.game.currentWordlist = remaining;

        renderSuggestions(remaining);

        if (remaining.length === 1) {
            setStatus(`Solved: the word is "${remaining[0]}".`);
            submitBtn.disabled = true;
            return;
        }
        if (remaining.length === 0) {
            setStatus('No words match these constraints. Check the colors you entered.', true);
            submitBtn.disabled = true;
            return;
        }

        if (state.rowIndex + 1 >= MAX_ROWS) {
            setStatus(`Out of rows. ${remaining.length} words still possible.`);
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
        setStatus(`${state.allWords.length} words loaded. Start with your opening guess.`);
        renderSuggestions(state.allWords);
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

    loadWordList();
})();
