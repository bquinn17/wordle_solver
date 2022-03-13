from operator import itemgetter
from eliminate_words import eliminate, parse_guess_result


def get_best_words(remaining_words):
    char_frequency_map = create_char_freq_map(remaining_words)
    word_score_map = create_word_score_map(remaining_words, char_frequency_map)
    return word_score_map


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
