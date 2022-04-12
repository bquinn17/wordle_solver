from char_freq_ranker import get_best_words
from eliminate_words import get_remaining_words


class GameState:

    def __init__(self):
        self.wordlist_file = 'word_lists/corncob_5_letters.txt'
        self.current_wordlist = self.__get_five_letter_words__()
        self.known_letters = [None, None, None, None, None]
        self.bad_letters = set()
        self.yellow_letters = dict()

    def enter_guess_result(self, guess_result):
        remaining_words = get_remaining_words(guess_result, self)

        self.current_wordlist = remaining_words

        words_ranked = get_best_words(remaining_words)
        return words_ranked

    def __get_five_letter_words__(self):
        five_letter_words = []
        with open(self.wordlist_file, 'r') as file:
            for line in file:
                if len(line.strip()) == 5:
                    five_letter_words.append(line.strip())

        return five_letter_words
