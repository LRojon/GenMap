from main import Map

# Smaller map for speed
m, s = Map.genTerrain(seed=1, width=80, height=80, octaves=4)
import random
random.seed(1)
r = Map.genRiver(m, [], min_height=140)
print('River length:', len(r))
print('First 10 points:', r[:10])
