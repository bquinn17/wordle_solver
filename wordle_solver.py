from game_state import enter_guess_result

# a,b r,y o,y s,g e,g

def main():
    guess_result = []
    while True:
        print("Enter guess result: ")
        guess_result_string = input()
        for char_result in guess_result_string.split(" "):
            char, result = char_result.split(',')
            guess_result.append((char, result))
        print(guess_result)
        enter_guess_result(guess_result)


if __name__ == "__main__":
    main()
