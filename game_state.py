from char_freq_ranker import get_best_words
from eliminate_words import get_remaining_words

WORDLIST_FILE = 'corncob_lowercase.txt'

CURRENT_WORDLIST = None

def enter_guess_result(guess_result):
    global CURRENT_WORDLIST
    remaining_words = get_remaining_words(guess_result, get_current_wordlist())

    CURRENT_WORDLIST = remaining_words

    words_ranked = get_best_words(remaining_words)
    print(words_ranked)
    print("Total remaining words: ", len(remaining_words))



def get_current_wordlist():
    global CURRENT_WORDLIST
    if CURRENT_WORDLIST == None:
        CURRENT_WORDLIST = get_five_letter_words()
    return CURRENT_WORDLIST


def get_five_letter_words():
    five_letter_words = []
    with open(WORDLIST_FILE, 'r') as file:
        for line in file:
            if len(line.strip()) == 5:
                five_letter_words.append(line.strip())

    return five_letter_words
