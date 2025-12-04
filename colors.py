from PIL import Image

class Colors:
    instance = None

    def __init__(self):
        img = Image.open("ramp.png")
        width, height = img.size

        self.colors = []
        for x in range(256):
            px: int = int(x * (width - 1) / 255)
            r, g, b = img.getpixel((px, 2))
            self.colors.append((r, g, b))
        self.simplifiedColors = [
            (0, 0, 128),      # Deep Water
            (0, 0, 255),      # Shallow Water
            (240, 240, 64),   # Sand
            (32, 160, 0),     # Grass
            (128, 128, 128),  # Rock
            (255, 255, 255)   # Snow
        ]
        print(self.colors)

    @staticmethod
    def get_instance():
        if Colors.instance is None:
            Colors.instance = Colors()
        return Colors.instance
    
    @staticmethod
    def getColor(value: int):
        colors = Colors.get_instance().colors
        if value <= 0:
            value = 255
        elif value > 255:
            value = 255
        return colors[value]
    
    @staticmethod
    def getSimplifiedColor(value: int):
        colors = Colors.get_instance().simplifiedColors
        if value < 51:
            return colors[0]  # Deep Water
        elif value < 102:
            return colors[1]  # Shallow Water
        elif value < 153:
            return colors[2]  # Sand
        elif value < 204:
            return colors[3]  # Grass
        elif value < 230:
            return colors[4]  # Rock
        else:
            return colors[5]  # Snow