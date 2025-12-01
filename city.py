import random
import time

class City:
    def __init__(self, position: tuple[int, int], seed: int = 0) -> None:
        self.position = position
        self.seed = seed
        self.name = ""
        self.population = 0
        self.religion = None
        self.country = None
        self.score = 0
        
class Cities:

    def get_min_score(self):
        if not self.cities:
            return 0
        return min(city.score for city in self.cities)

    def get_max_score(self):
        if not self.cities:
            return 1
        return max(city.score for city in self.cities)

    def __init__(self) -> None:
        self.cities: list[City] = []
    
    def generateCity(self, position: tuple[int, int], score: int = 0, seed: int = 0) -> None:
        random.seed(seed if seed != 0 else time.time_ns() % (2**32))
        city = City(position, seed)
        city.score = score
        self.cities.append(city)
        