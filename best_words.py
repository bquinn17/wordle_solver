from operator import itemgetter
from eliminate_words import eliminate, parse_guess_result

WORDLIST_FILE = 'corncob_lowercase.txt'

CURRENT_WORDLIST = None

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

def create_char_freq_map(five_letter_words):
    char_frequency_map = {}

    for word in five_letter_words:
        for char in word:
            if char in char_frequency_map:
                char_frequency_map[char] += 1
            else:
                char_frequency_map[char] = 1


    char_frequency_map = dict(sorted(char_frequency_map.items(), key=lambda item: item[1], reverse=True))
    return char_frequency_map


def create_word_score_map(five_letter_words, char_frequency_map):
    word_score_map = {}

    for word in five_letter_words:
        word_sum = 0
        letter_set = set()
        for char in word:
            if not char in letter_set:
                word_sum += char_frequency_map[char]
                letter_set.add(char)
        word_score_map[word] = word_sum

    word_score_map = dict(sorted(word_score_map.items(), key=lambda item: item[1]))

    return word_score_map


def enter_guess_result(guess_result):
    global CURRENT_WORDLIST
    current_wordlist = get_current_wordlist()

    parse_guess_result(guess_result)
    remaining_words = eliminate(current_wordlist)

    char_frequency_map = create_char_freq_map(remaining_words)
    word_score_map = create_word_score_map(remaining_words, char_frequency_map)
    print(word_score_map)
    print("Total remaining words: ", len(remaining_words))

    CURRENT_WORDLIST = remaining_words


def main():
    guess_result = (('a','y'),('r','b'),('o','b'),('s','g'),('e','g'))
    enter_guess_result(guess_result)


if __name__ == "__main__":
    main()