# wordle_solver

The script `wordle_solver.py` will assist you in solving wordle games by automatically eliminating words 
that do not work from an english word list, and suggesting the best possible guesses.

## How to use

1. Enter your favorite first word into a wordle game (I use arose).
2. Run `python3 wordle_solver.py`.
3. Enter the results from you guess like the example below, where `b` is for 
black/gray letters, `y` is for yellow letters, and `g` is for green letters.
4. Choose one of the top suggestions to enter next.
5. Go back to step 3.

`a,b r,y o,y s,g e,g`

## How it Works

The solver uses two strategies:

- The first strategy `char_freq_ranker` ranks potential guess by the sum of the number of words each letter occurs in. 
- The second strategy `eliminate_ranker` calculates the average number of eliminated words each guess will have, given 
that the target word is any remaining word.
