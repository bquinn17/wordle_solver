KNOWN_LETTERS = [None, None, None, None, None]
BAD_LETTERS = set()
YELLOW_LETTERS = dict()


def get_remaining_words(guess_result, current_wordlist):
    parse_guess_result(guess_result)
    remaining_words = eliminate(current_wordlist)
    return remaining_words


def eliminate(current_word_list):
    result_word_list = []
    for word in current_word_list:
        keep_word = __test_word__(word)
        if keep_word:
            result_word_list.append(word)

    return result_word_list


def parse_guess_result(guess_result):
    global KNOWN_LETTERS, BAD_LETTERS, YELLOW_LETTERS
    for i in range(len(guess_result)):
        character_result = guess_result[i]
        character = character_result[0]
        result = character_result[1]

        if result == 'g':
            KNOWN_LETTERS[i] = character
        elif result == 'b':
            BAD_LETTERS.add(character)
        elif result == 'y':
            if character in YELLOW_LETTERS:
                YELLOW_LETTERS[character].add(i)
            else:
                newSet = set()
                newSet.add(i)
                YELLOW_LETTERS[character] = newSet
        else:
            print(f"Error: invalid result for character: {result}")


def __test_word__(word):
    for char in YELLOW_LETTERS:
        if char not in word:
            # All yellow letters must appear somewhere in the word
            return False

    for i in range(len(word)):
        character = word[i]
        if character in BAD_LETTERS:
            # There cannot be any bad letters in the word
            return False
        elif KNOWN_LETTERS[i] is not None:
            if KNOWN_LETTERS[i] != character:
                # If there is a green letter in this position, it must match
                return False
        elif character in YELLOW_LETTERS:
            if i in YELLOW_LETTERS[character]:
                # The character is yellow in this position and not green
                return False
    return True


if __name__ == "__main__":
    EXAMPLE_GUESS_RESULT = (('a', 'y'), ('r', 'b'), ('o', 'b'), ('s', 'g'), ('e', 'g'))
    EXAMPLE_WORD_LIST = ('arose', 'blase', 'blown')
    parse_guess_result(EXAMPLE_GUESS_RESULT)
    print(f"BAD_LETTERS: {BAD_LETTERS}")
    print(f"KNOWN_LETTERS: {KNOWN_LETTERS}")
    print(f"YELLOW_LETTERS: {YELLOW_LETTERS}")
    new_word_list = eliminate(EXAMPLE_WORD_LIST)
    print(new_word_list)
