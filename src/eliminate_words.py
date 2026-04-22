
def get_remaining_words(guess_result, game_state):
    __parse_guess_result__(guess_result, game_state)
    remaining_words = __eliminate__(game_state)
    return remaining_words


def __eliminate__(game_state):
    result_word_list = []
    for word in game_state.current_wordlist:
        keep_word = __test_word__(word, game_state)
        if keep_word:
            result_word_list.append(word)

    return result_word_list


def __parse_guess_result__(guess_result, game_state):
    for i in range(len(guess_result)):
        character_result = guess_result[i]
        character = character_result[0]
        result = character_result[1]

        if result == 'g':
            game_state.known_letters[i] = character
        elif result == 'b':
            game_state.bad_letters.add(character)
        elif result == 'y':
            if character in game_state.yellow_letters:
                game_state.yellow_letters[character].add(i)
            else:
                new_set = set()
                new_set.add(i)
                game_state.yellow_letters[character] = new_set
        else:
            print(f"Error: invalid result for character: {result}")


def __test_word__(word, game_state):
    for char in game_state.yellow_letters:
        if char not in word:
            # All yellow letters must appear somewhere in the word
            return False

    for i in range(len(word)):
        character = word[i]
        if character in game_state.bad_letters:
            # There cannot be any bad letters in the word
            return False
        elif game_state.known_letters[i] is not None:
            if game_state.known_letters[i] != character:
                # If there is a green letter in this position, it must match
                return False
        elif character in game_state.yellow_letters:
            if i in game_state.yellow_letters[character]:
                # The character is yellow in this position and not green
                return False
    return True


if __name__ == "__main__":
    EXAMPLE_GUESS_RESULT = (('a', 'y'), ('r', 'b'), ('o', 'b'), ('s', 'g'), ('e', 'g'))
    EXAMPLE_WORD_LIST = ('arose', 'blase', 'blown')
    # parse_guess_result(EXAMPLE_GUESS_RESULT)
    # print(f"BAD_LETTERS: {BAD_LETTERS}")
    # print(f"KNOWN_LETTERS: {KNOWN_LETTERS}")
    # print(f"YELLOW_LETTERS: {YELLOW_LETTERS}")
    # new_word_list = eliminate(EXAMPLE_WORD_LIST)
    # print(new_word_list)
