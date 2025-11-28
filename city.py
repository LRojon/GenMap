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
        
class Cities:

    def __init__(self) -> None:
        self.cities: list[City] = []
    
    def generateCity(self, position: tuple[int, int], seed: int = 0) -> None:
        random.seed(seed if seed != 0 else time.time_ns() % (2**32))
        city = City(position, seed)
        self.cities.append(city)
        