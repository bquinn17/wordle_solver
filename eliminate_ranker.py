import copy

from eliminate_words import get_remaining_words


def get_best_words(remaining_words, game_state):
    word_to_eliminations = {}
    for word in remaining_words:
        words_eliminated = test_word(word, remaining_words, game_state)
        word_to_eliminations[word] = words_eliminated
    
    word_to_eliminations = dict(sorted(word_to_eliminations.items(), key=lambda item: item[1], reverse=True))
    return word_to_eliminations


def test_word(word_to_guess, remaining_words, game_state):
    """
    Play out all scenarios where this word is guessed, and any of the remaining words are the actual solution.
    In other words, test this word using every word as the hidden word.
    :param word_to_guess: word being guessed
    :param remaining_words: possible words that could be the solution
    :return average of the number of words eliminated using this guess in every scenario
    """
    total_words_eliminated = 0
    current_wordlist_size = len(remaining_words)
    for scenario_target_word in remaining_words:
        game_state_copy = copy.deepcopy(game_state)
        guess_result = __generate_guess_result__(word_to_guess, scenario_target_word)
        scenario_remaining_words = get_remaining_words(guess_result, game_state_copy)
        words_eliminated = current_wordlist_size - len(scenario_remaining_words)
        total_words_eliminated += words_eliminated

    return round(total_words_eliminated / current_wordlist_size, 2)


def __generate_guess_result__(guessed_word: str, actual_word: str):
    guess_result = []
    for char_index in range(len(guessed_word)):
        if guessed_word[char_index] == actual_word[char_index]:
            guess_result.append((guessed_word[char_index], 'g'))
        elif guessed_word[char_index] in actual_word:
            guess_result.append((guessed_word[char_index], 'y'))
        else:
            guess_result.append((guessed_word[char_index], 'b'))
    return guess_result


if __name__ == '__main__':
    result = __generate_guess_result__('snake', 'bakes')
    print(result)
