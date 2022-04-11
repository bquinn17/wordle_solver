from char_freq_ranker import get_best_words
from eliminate_words import get_remaining_words


class GameState:

    def __init__(self):
        self.wordlist_file = 'corncob_lowercase.txt'
        self.current_wordlist = self.__get_five_letter_words__()

    def enter_guess_result(self, guess_result):
        remaining_words = get_remaining_words(guess_result, self.current_wordlist)

        self.current_wordlist = remaining_words

        words_ranked = get_best_words(remaining_words)
        print(words_ranked)
        print("Total remaining words: ", len(remaining_words))

    def __get_five_letter_words__(self):
        five_letter_words = []
        with open(self.wordlist_file, 'r') as file:
            for line in file:
                if len(line.strip()) == 5:
                    five_letter_words.append(line.strip())

        return five_letter_words
