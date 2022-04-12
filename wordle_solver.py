import itertools

from game_state import GameState

# a,b r,y o,y s,g e,g


def main():
    game_state = GameState()
    while True:
        print("Enter guess result: ")
        guess_result_string = input()
        guess_result = []
        for char_result in guess_result_string.split(" "):
            char, result = char_result.split(',')
            guess_result.append((char, result))
        print(guess_result)
        words_ranked = game_state.enter_guess_result(guess_result)
        print("Top suggested guesses: ")
        print(dict(itertools.islice(words_ranked.items(), 5)))
        print("Total remaining words: ", len(game_state.current_wordlist))


if __name__ == "__main__":
    main()
