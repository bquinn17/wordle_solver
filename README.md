# Wordle Solver

The script `src/wordle_solver.py` will assist you in solving wordle games by automatically eliminating
words that do not work from an english word list, and suggesting the best possible guesses.

A browser-based version of the solver is also included — see [Interactive web version](#interactive-web-version).

## Project layout

```
index.html           # entry point for the web app
app/
  styles.css
  js/
    solver.js        # JS port of the solver
    app.js           # UI glue
src/                 # Python CLI solver
  wordle_solver.py
  game_state.py
  eliminate_words.py
  char_freq_ranker.py
  eliminate_ranker.py
word_lists/
  corncob_5_letters.txt
```

## How to use (Python CLI)

1. Enter your favorite first word into a wordle game (see [Best First Word](#best-first-word)).
2. From the repo root, run `python3 src/wordle_solver.py`.
3. Enter the results from you guess like the example below, where `b` is for 
black/gray letters, `y` is for yellow letters, and `g` is for green letters.
4. Choose one of the top suggestions to enter next.
5. Go back to step 3.

### Entering results from this wordle guess:

![image](https://user-images.githubusercontent.com/14142655/167738723-22471817-2320-4666-af25-676194e03431.png)

```
Enter guess result: 
a,b r,b o,g s,y e,b
```

## How it Works

The solver uses two strategies:

- The first strategy `char_freq_ranker` ranks potential guess by the sum of the number of words each letter occurs in. 
- The second strategy `eliminate_ranker` calculates the average number of eliminated words each guess will have, given 
that the target word is any remaining word.

## Best First Word

By running these ranking algorithms once on an entire starting wordlist, we can calculate what will **always** be the best 
starting word. Below are the results from running the rankers against the full word list:

```
Top suggested guesses (char freq ranker): 
{'arose': 9170, 'earls': 9067, 'laser': 9067, 'reals': 9067, 'arise': 9027}
```

## Interactive web version

A JavaScript port of the solver is available as a single-page webpage. Files:

- `index.html` — page markup (kept at the repo root)
- `app/styles.css` — styling
- `app/js/solver.js` — port of `game_state.py`, `eliminate_words.py`, `char_freq_ranker.py`, and `eliminate_ranker.py`
- `app/js/app.js` — UI glue

### Running

The page fetches `word_lists/corncob_5_letters.txt` at load time, which browsers block from the `file://`
protocol. From the repo root, start any static server, e.g.:

```
python -m http.server
```

Then open <http://localhost:8000/> in your browser.

### Using

1. Type a 5-letter guess — letters fill the active row.
2. Click each letter to cycle its color: gray → yellow → green.
3. Press `Enter` (or click **Submit guess**) to apply the result.
4. The page shows the remaining word count, the top 5 guesses by character-frequency score, and the top 5
   guesses by the eliminate ranker (skipped when the remaining list is very large, since it is O(n²)).

The first-guess suggestions are hard-coded in `app/js/app.js` (ie. `INITIAL_CHAR_FREQ_TOP`) since they are
always the same regardless of play. Regenerate them by running the Python solver on the full word list.
