"""
Rank every word in the starting word list by the eliminate-ranker score,
parallelized across N worker processes. Prints live progress with an ETA,
then the top-K words.

This produces identical numbers to running ``eliminate_ranker.get_best_words``
on a fresh ``GameState`` — but in seconds instead of hours. The speedup comes
from a mathematical rewrite of the inner loop (see "Approach" below) plus
multi-process parallelism.


Approach
--------

**Definitions.** A Wordle "pattern" is a 5-character color string produced
when a guessed word is scored against an actual word: each position is GREEN
(letter correct and in the right spot), YELLOW (letter is somewhere else in
the word), or GRAY (letter not in the word at all). Write ``pattern(G, X)``
for the pattern that guess ``G`` produces when the actual word is ``X``.

**The original algorithm.** For each candidate guess ``G`` and each possible
actual word ``T`` in the word list, simulate the guess: compute
``pattern(G, T)``, apply it as a filter to the entire word list, and count how
many words remain. Average "words eliminated" over all ``T`` is the score for
``G``. That's O(n^3) work for ``n`` candidate words: n guesses × n targets ×
n-word filter per target. On the ~4300-word starting list, that's 79.5 billion 
operations and roughly that many ``copy.deepcopy`` calls.

**The optimization: histogram identity.** Under this solver's scoring rules
(see ``eliminate_words.__test_word__``), a candidate word ``W`` survives the
filter implied by ``pattern(G, T)`` if and only if
``pattern(G, W) == pattern(G, T)``. In other words, every word with the same
color-pattern against ``G`` forms one equivalence class, and any one of them
as the true answer would leave exactly that whole class as the "remaining"
words.

So for a fixed guess ``G``, we only need the histogram of patterns that ``G``
produces across the word list. If ``count[p]`` is the number of words that
produce pattern ``p`` against ``G``, then:

    total_eliminated_over_all_targets
        = sum over targets T of (n - words_remaining_for_T)
        = sum over targets T of (n - count[pattern(G, T)])
        = n*n  -  sum over patterns p of count[p] * count[p]

    average_eliminated = total_eliminated_over_all_targets / n

That collapses the inner work from O(n^2) per guess to O(n), giving an
O(n^2) overall algorithm. The final ``round(..., 2)`` matches the original.

**Why processes, not threads.** This is a pure-Python, CPU-bound loop, so the
GIL prevents threads from running in parallel. ``multiprocessing.Pool`` gives
real parallelism: each worker receives a copy of the pre-computed target data
once (via the pool initializer) and then scores individual guess words.


Usage
-----

Run from the repository root::

    python3 src/eliminate_ranker_full.py [--workers 6] [--top 10]
"""

import argparse
import sys
import time
from multiprocessing import Pool
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_WORDLIST_PATH = (
    Path(__file__).resolve().parent.parent / 'word_lists' / 'corncob_5_letters.txt'
)

WORD_LENGTH = 5

# Pattern-code values per position. Encoded as base-3 digits so a full 5-letter
# pattern fits in a single small integer (0..242), which is cheap to use as a
# dict key.
color_GRAY = 0     # guessed letter not in the target word at all
color_YELLOW = 1   # guessed letter in the target, but not at this position
color_GREEN = 2    # guessed letter matches the target at this position


# ---------------------------------------------------------------------------
# Per-worker state
# ---------------------------------------------------------------------------
#
# The target-word data (a character tuple and a letter set for each word in the
# list) is identical for every scoring call. Rather than pickling it with every
# task, we send it once to each worker via the Pool initializer and stash it in
# module-level globals. The scoring function reads these directly.
#
# ``target_char_tuples``: list of 5-tuples. e.g. "arose" -> ('a','r','o','s','e').
#     Tuple indexing is slightly faster than string indexing in the hot loop.
# ``target_letter_sets``:  list of frozensets. e.g. "arose" -> frozenset({'a','r','o','s','e'}).
#     Used for the "is this letter anywhere in the word?" check (yellow vs gray)
#     in O(1) instead of scanning the string each time.

target_char_tuples = None  # type: list[tuple[str, ...]] | None
target_letter_sets = None  # type: list[frozenset[str]] | None


def _init_worker(char_tuples_for_targets, letter_sets_for_targets):
    """Populate this worker's module globals once, at pool startup."""
    global target_char_tuples, target_letter_sets
    target_char_tuples = char_tuples_for_targets
    target_letter_sets = letter_sets_for_targets


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_guess_word(guess_word):
    """Return ``(guess_word, average_words_eliminated)`` rounded to 2 decimals.

    This is the per-guess inner function that workers run. It applies the
    histogram optimization described at the top of this file:

      1. Walk every target word in the list. Compute the 5-position color
         pattern that ``guess_word`` would produce against that target, and
         encode it as a base-3 integer.
      2. Tally how many targets fall into each pattern bucket.
      3. Combine the bucket counts into a single score:
             total_eliminated = n*n - sum(count * count)
             average          = total_eliminated / n

    The inner loop is hand-unrolled across all five positions. Python's
    per-iteration overhead is large enough that an explicit ``for pos in
    range(5)`` loop measurably slows this down — and this is the hottest code
    in the program.
    """
    # Destructure the guess once, outside the target loop.
    guess_letter_0, guess_letter_1, guess_letter_2, guess_letter_3, guess_letter_4 = guess_word

    # Localise the worker globals. Python attribute lookups on module globals
    # are slower than local-variable reads inside the loop body.
    targets_chars = target_char_tuples
    targets_sets = target_letter_sets
    word_count = len(targets_chars)

    # Bucket counter: encoded_pattern -> number of targets producing it.
    pattern_counts = {}

    for target_index in range(word_count):
        target_letter_0, target_letter_1, target_letter_2, target_letter_3, target_letter_4 = targets_chars[target_index]
        target_letters = targets_sets[target_index]

        # Per-position color: GREEN if same letter at same position,
        # else YELLOW if the letter appears somewhere in the target,
        # else GRAY.
        color_0 = color_GREEN if guess_letter_0 == target_letter_0 else (
            color_YELLOW if guess_letter_0 in target_letters else color_GRAY
        )
        color_1 = color_GREEN if guess_letter_1 == target_letter_1 else (
            color_YELLOW if guess_letter_1 in target_letters else color_GRAY
        )
        color_2 = color_GREEN if guess_letter_2 == target_letter_2 else (
            color_YELLOW if guess_letter_2 in target_letters else color_GRAY
        )
        color_3 = color_GREEN if guess_letter_3 == target_letter_3 else (
            color_YELLOW if guess_letter_3 in target_letters else color_GRAY
        )
        color_4 = color_GREEN if guess_letter_4 == target_letter_4 else (
            color_YELLOW if guess_letter_4 in target_letters else color_GRAY
        )

        # Pack the five base-3 color digits into a single int (0..242).
        encoded_pattern = (
            ((((color_0 * 3 + color_1) * 3 + color_2) * 3 + color_3) * 3 + color_4)
        )
        pattern_counts[encoded_pattern] = pattern_counts.get(encoded_pattern, 0) + 1

    # Apply the histogram identity:
    #   total_eliminated = n^2 - sum(count^2)
    #   average          = total_eliminated / n
    sum_of_squared_counts = 0
    for bucket_count in pattern_counts.values():
        sum_of_squared_counts += bucket_count * bucket_count

    total_words_eliminated_over_all_targets = word_count * word_count - sum_of_squared_counts
    average_words_eliminated = total_words_eliminated_over_all_targets / word_count

    # Match the original ``eliminate_ranker`` which rounds to 2 decimals.
    return guess_word, round(average_words_eliminated, 2)


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_five_letter_words(wordlist_path):
    """Read the word-list file and return the lowercase 5-letter words."""
    words = []
    for raw_line in wordlist_path.read_text().splitlines():
        stripped = raw_line.strip().lower()
        if len(stripped) == WORD_LENGTH:
            words.append(stripped)
    return words


def format_duration(seconds):
    """Render a duration compactly for progress lines: '12.3s', '04m30s', '1h05m'."""
    if seconds == float('inf'):
        return '  ?  '
    if seconds < 60:
        return f'{seconds:5.1f}s'
    minutes, remaining_seconds = divmod(int(seconds), 60)
    if minutes < 60:
        return f'{minutes:2d}m{remaining_seconds:02d}s'
    hours, remaining_minutes = divmod(minutes, 60)
    return f'{hours:2d}h{remaining_minutes:02d}m'


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def run_ranking(words, worker_count, progress_interval):
    """Score every word in ``words`` in parallel. Returns a list of (word, score).

    Results come back in completion order (``imap_unordered``) — the caller
    sorts them afterwards. Progress is printed in-place to stdout every
    ``progress_interval`` completions.
    """
    total_word_count = len(words)

    # Precompute per-word data once, on the main process. Workers will receive
    # these via the Pool initializer (pickled once per worker, not per task).
    target_char_tuples_list = [tuple(word) for word in words]
    target_letter_sets_list = [frozenset(word) for word in words]

    scores = []
    started_at = time.time()

    with Pool(
        processes=worker_count,
        initializer=_init_worker,
        initargs=(target_char_tuples_list, target_letter_sets_list),
    ) as pool:
        # ``chunksize=32`` batches tasks so the inter-process overhead doesn't
        # dominate the per-task cost. imap_unordered yields results as soon as
        # any worker finishes, so we get a smooth progress stream.
        results_iterator = pool.imap_unordered(score_guess_word, words, chunksize=32)

        for completed_count, guess_and_score in enumerate(results_iterator, start=1):
            scores.append(guess_and_score)

            is_last = completed_count == total_word_count
            if completed_count % progress_interval == 0 or is_last:
                elapsed_seconds = time.time() - started_at
                guesses_per_second = (
                    completed_count / elapsed_seconds if elapsed_seconds > 0 else 0.0
                )
                estimated_seconds_remaining = (
                    (total_word_count - completed_count) / guesses_per_second
                    if guesses_per_second > 0 else float('inf')
                )
                progress_line = (
                    f'\r  {completed_count:5d}/{total_word_count}  '
                    f'({100 * completed_count / total_word_count:5.1f}%)  '
                    f'elapsed={format_duration(elapsed_seconds)}  '
                    f'eta={format_duration(estimated_seconds_remaining)}  '
                    f'rate={guesses_per_second:5.0f} guesses/s'
                )
                sys.stdout.write(progress_line)
                sys.stdout.flush()

    sys.stdout.write('\n')
    return scores, time.time() - started_at


def main():
    parser = argparse.ArgumentParser(
        description='Rank the full starting word list by the eliminate-ranker score.'
    )
    parser.add_argument(
        '--workers', type=int, default=6,
        help='Number of worker processes (default: 6). This is CPU-bound, so '
             'threads would not help — processes give real parallelism.'
    )
    parser.add_argument(
        '--top', type=int, default=10,
        help='How many top-scoring words to print (default: 10).'
    )
    parser.add_argument(
        '--wordlist', type=Path, default=DEFAULT_WORDLIST_PATH,
        help='Path to the word-list file.'
    )
    parser.add_argument(
        '--progress-every', type=int, default=25,
        help='Refresh the progress line every N completed guesses (default: 25).'
    )
    args = parser.parse_args()

    if not args.wordlist.exists():
        print(f'Word list not found at {args.wordlist}', file=sys.stderr)
        sys.exit(1)

    words = load_five_letter_words(args.wordlist)
    word_count = len(words)

    print(
        f'Ranking {word_count} words across {args.workers} workers '
        f'(eliminate-ranker, pattern-histogram optimization).'
    )

    scores, total_seconds = run_ranking(
        words=words,
        worker_count=args.workers,
        progress_interval=args.progress_every,
    )

    print(f'Done in {format_duration(total_seconds)}.')

    scores.sort(key=lambda word_and_score: word_and_score[1], reverse=True)
    print(f'\nTop {args.top} by average words eliminated per guess:')
    for word, average_eliminated in scores[:args.top]:
        print(f'  {word}: {average_eliminated}')


if __name__ == '__main__':
    main()
