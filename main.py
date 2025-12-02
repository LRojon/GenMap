import os
from datetime import datetime
from colors import Colors
from voronoi import Voronoi, Cell, Edge
from skimage.draw import polygon
from map import Map
import time
import pygame
import sys
import numpy as np
import random

# ========== Palettes de couleurs ==========
BIOME_COLORS = {
    0: (30, 100, 200),      # Eau (bleu foncé)
    1: (238, 214, 175),     # Plage/Côte (sable)
    2: (144, 238, 144),     # Plaine (vert clair)
    3: (34, 139, 34),       # Forêt tempérée (vert foncé)
    4: (210, 180, 140),     # Prairie (beige)
    5: (255, 215, 0),       # Désert (or)
    6: (128, 128, 64),      # Collines (olive)
    7: (169, 169, 169),     # Montagne (gris)
    8: (255, 255, 255),     # Pics/Neige (blanc)
    9: (0, 100, 0),         # Jungle (vert très foncé)
    10: (144, 200, 160),    # Marécage (cyan-vert)
}

def get_climate_color(climate_value: int):
    """Retourne une couleur basée sur la valeur de climat (0-255)."""
    # 0-85: Bleu (polaire)
    # 85-127: Cyan (tempéré froid)
    # 127-170: Vert (tempéré chaud)
    # 170-210: Orange (tropical)
    # 210-255: Rouge (désertique)
    if climate_value < 85:
        # Bleu polaire
        return (100, 150, 255)
    elif climate_value < 127:
        # Cyan tempéré froid
        return (100, 200, 255)
    elif climate_value < 170:
        # Vert tempéré chaud
        return (100, 255, 100)
    elif climate_value < 210:
        # Orange tropical
        return (255, 150, 100)
    else:
        # Rouge désertique
        return (255, 100, 100)

seed = sys.argv[1] if len(sys.argv) > 1 else None

pygame.init()
map_width, map_height = 400, 400
info_panel_width = 280  # Largeur du panneau d'infos sur la gauche (augmentée encore de 220)
tab_bar_height = 40    # Hauteur de la barre de tabs en haut
info_bar_height = 50   # Hauteur de la barre d'info en bas

total_width = map_width + info_panel_width
total_height = map_height + tab_bar_height + info_bar_height

window = pygame.display.set_mode((total_width, total_height))
pygame.display.set_caption("Map")

startTime = time.time()
elapsed = 0.0
seed = int(seed) if seed is not None else time.time_ns() % (2**32)
game_map = Map(map_width, map_height, seed)
elapsed += time.time() - startTime
print(f"Génération de la map en {time.time() - startTime:.2f}s avec le seed {seed}")
print(f"Nombre de villes : {len(game_map.cities.cities)}")
print(f"Nombre de routes : {len(game_map.routes)}")
if game_map.routes:
    print(f"Longueur moyenne des routes : {sum(len(r) for r in game_map.routes) / len(game_map.routes):.1f} pixels")

# Générer des couleurs pour les pays
num_countries = len(set(c.country for c in game_map.cities.cities if c.country is not None))
country_colors = {}
np.random.seed(seed)
for i in range(num_countries + 1):
    country_colors[i] = (np.random.randint(50, 200), np.random.randint(50, 200), np.random.randint(50, 200))

startTime = time.time()
    
# Initialisation de la police pour l'affichage du texte
pygame.font.init()
font = pygame.font.SysFont(None, 24)

# ========== Système de tabs ==========
class TabSystem:
    def __init__(self, x, y, tab_height, map_width, info_panel_width, font_obj):
        self.x = x
        self.y = y
        self.tab_height = tab_height
        self.map_width = map_width
        self.info_panel_width = info_panel_width
        self.font = font_obj
        self.margin = 15
        
        self.tabs = [
            {'name': 'Map', 'icon': '🗺', 'key': pygame.K_1, 'show_legend': False},
            {'name': 'Countries', 'icon': '🏛', 'key': pygame.K_2, 'show_legend': False},
            {'name': 'Cities', 'icon': '🏙', 'key': pygame.K_3, 'show_legend': False},
            {'name': 'Routes', 'icon': '🛣', 'key': pygame.K_4, 'show_legend': False},
            {'name': 'Biomes', 'icon': '🌿', 'key': pygame.K_5, 'show_legend': True},
            {'name': 'Climate', 'icon': '🌡', 'key': pygame.K_6, 'show_legend': True},
            {'name': 'Religions', 'icon': '⛪', 'key': pygame.K_7, 'show_legend': True},
            {'name': 'Cultures', 'icon': '🎭', 'key': pygame.K_8, 'show_legend': True},
        ]
        self.active_tab = 0
        
        # Calculer la largeur des tabs (fixe avec noms raccourcis)
        self.tab_width = 50  # Largeur pour chaque tab (nom raccourci: "Clim.", "Religi.", etc)
        self.tab_rects = []
        
        for i in range(len(self.tabs)):
            current_x = self.x + i * self.tab_width
            self.tab_rects.append(pygame.Rect(current_x, self.y, self.tab_width, self.tab_height))
    
    def get_tab_rect(self, tab_idx):
        """Retourne le rectangle d'un tab."""
        if 0 <= tab_idx < len(self.tab_rects):
            return self.tab_rects[tab_idx]
        return pygame.Rect(0, 0, 0, 0)
    
    def get_active_display_mode(self):
        """Retourne le mode d'affichage actif."""
        modes = {
            0: 'terrain',
            1: 'countries',
            2: 'terrain',  # Cities utilise terrain + affichage villes
            3: 'terrain',  # Routes utilise terrain + affichage routes
            4: 'biomes',
            5: 'climate',
            6: 'religions',
            7: 'cultures'
        }
        return modes[self.active_tab]
    
    def get_show_legend(self):
        """Indique si une légende doit être affichée."""
        return self.tabs[self.active_tab]['show_legend']
    
    def get_active_tab_name(self):
        """Retourne le nom du tab actif."""
        return self.tabs[self.active_tab]['name']
    
    def handle_click(self, pos):
        """Gère le clic sur les tabs."""
        x, y = pos
        for i, tab in enumerate(self.tabs):
            rect = self.get_tab_rect(i)
            if rect.collidepoint(x, y):
                self.active_tab = i
                return True
        return False
    
    def handle_keypress(self, key):
        """Gère les touches clavier pour switcher de tab."""
        for i, tab in enumerate(self.tabs):
            if key == tab['key']:
                self.active_tab = i
                return True
        return False
    
    def draw(self, window, font_small):
        """Dessine les tabs horizontalement en haut avec icônes."""
        # Fond de la barre de tabs
        tab_bar_rect = pygame.Rect(0, self.y, self.map_width + self.info_panel_width, self.tab_height)
        pygame.draw.rect(window, (200, 200, 200), tab_bar_rect)
        pygame.draw.line(window, (100, 100, 100), (0, self.y + self.tab_height), 
                        (self.map_width + self.info_panel_width, self.y + self.tab_height), 2)
        
        key_names = {pygame.K_1: '1', pygame.K_2: '2', pygame.K_3: '3', 
                    pygame.K_4: '4', pygame.K_5: '5', pygame.K_6: '6',
                    pygame.K_7: '7', pygame.K_8: '8'}
        
        for i, tab in enumerate(self.tabs):
            rect = self.get_tab_rect(i)
            
            # Couleur différente selon si le tab est actif
            if i == self.active_tab:
                pygame.draw.rect(window, (100, 150, 255), rect)
                text_color = (255, 255, 255)
            else:
                pygame.draw.rect(window, (180, 180, 180), rect)
                text_color = (0, 0, 0)
            
            pygame.draw.line(window, (100, 100, 100), (rect.right, rect.top), 
                           (rect.right, rect.bottom), 1)
            
            # Afficher le nom raccourci (5 premières lettres + point si trop long)
            tab_name = tab['name']
            if len(tab_name) > 5:
                display_text = tab_name[:5] + "."
            else:
                display_text = tab_name
            
            text_surface = font_small.render(display_text, True, text_color)
            text_rect = text_surface.get_rect(center=rect.center)
            window.blit(text_surface, text_rect)

tab_system = TabSystem(0, 0, tab_bar_height, map_width, info_panel_width, font)

running = True
mouse_value = None
mouse_pos = (0, 0)
show_countries_overlay = False  # État du toggle pour affichage pays
show_biomes = False  # État du toggle pour affichage biomes
show_climate = False  # État du toggle pour affichage climat

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.MOUSEBUTTONDOWN:
            # Gérer les clics sur les tabs
            tab_system.handle_click(event.pos)
        elif event.type == pygame.KEYDOWN:
            # Gérer les touches pour les tabs
            if tab_system.handle_keypress(event.key):
                pass
            elif event.key == pygame.K_s:
                os.makedirs('screenshots', exist_ok=True)
                filename = datetime.now().strftime('screenshots/screenshot_%Y%m%d_%H%M%S.png')
                pygame.image.save(window, filename)
                print(f"Screenshot sauvegardé : {filename}")
            elif event.key == pygame.K_RETURN:
                # Régénération rapide du monde avec un nouveau seed
                seed = time.time_ns() % (2**32)
                game_map = Map(map_width, map_height, seed)
                print(f"Nouveau monde généré avec le seed {seed}")
                # Régénérer les couleurs des pays
                num_countries = len(set(c.country for c in game_map.cities.cities if c.country is not None))
                country_colors = {}
                np.random.seed(seed)
                for i in range(num_countries + 1):
                    country_colors[i] = (np.random.randint(50, 200), np.random.randint(50, 200), np.random.randint(50, 200))

    window.fill(Colors.getColor(255))

    # Récupérer la position du curseur (ajustée pour le panneau gauche et la barre de tabs)
    mouse_pos = pygame.mouse.get_pos()
    mx, my = mouse_pos[0] - info_panel_width, mouse_pos[1] - tab_bar_height
    
    # Vérifier si la souris est dans la zone de la carte
    if 0 <= mx < map_width and 0 <= my < map_height:
        mouse_value = game_map.map[my][mx]
    else:
        mouse_value = None

    # ========== RENDU DE LA CARTE ==========
    display_mode = tab_system.get_active_display_mode()
    
    # Rendu terrain de base
    for y in range(map_height):
        for x in range(map_width):
            window.set_at((info_panel_width + x, tab_bar_height + y), Colors.getColor(game_map.map[y][x]))
    
    # Overlay biomes ou climat avec opacité
    if display_mode == 'biomes':
        for y in range(map_height):
            for x in range(map_width):
                biome_id = game_map.biomes[y][x]
                biome_color = BIOME_COLORS.get(biome_id, (128, 128, 128))
                terrain_color = window.get_at((info_panel_width + x, tab_bar_height + y))
                
                # Blending avec opacité 35%
                opacity = 0.35
                blended = (
                    int(terrain_color[0] * (1 - opacity) + biome_color[0] * opacity),
                    int(terrain_color[1] * (1 - opacity) + biome_color[1] * opacity),
                    int(terrain_color[2] * (1 - opacity) + biome_color[2] * opacity)
                )
                window.set_at((info_panel_width + x, tab_bar_height + y), blended)
    
    elif display_mode == 'climate':
        for y in range(map_height):
            for x in range(map_width):
                climate_value = game_map.climate[y][x]
                climate_color = get_climate_color(climate_value)
                terrain_color = window.get_at((info_panel_width + x, tab_bar_height + y))
                
                # Blending avec opacité 35%
                opacity = 0.35
                blended = (
                    int(terrain_color[0] * (1 - opacity) + climate_color[0] * opacity),
                    int(terrain_color[1] * (1 - opacity) + climate_color[1] * opacity),
                    int(terrain_color[2] * (1 - opacity) + climate_color[2] * opacity)
                )
                window.set_at((info_panel_width + x, tab_bar_height + y), blended)

    for river in game_map.rivers:
        for i in range(len(river)):
            riv_x, riv_y = river[i]
            if 0 <= riv_x < map_width and 0 <= riv_y < map_height:
                window.set_at((info_panel_width + riv_x, tab_bar_height + riv_y), Colors.getColor(127))

    # ========== OVERLAYS PAR MODE ==========
    
    # Overlay des religions - avec opacité 40%
    if display_mode == 'religions' and hasattr(game_map, 'religions'):
        for y in range(map_height):
            for x in range(map_width):
                region_id = int(game_map.religions[y, x])  # Convertir uint32 vers int
                # Utiliser la couleur depuis le ReligionSystem si disponible
                if hasattr(game_map, 'religion_system') and region_id in game_map.religion_system.religions:
                    color = game_map.religion_system.religions[region_id].color
                else:
                    # Fallback: générer une couleur depuis region_id
                    rng = random.Random(region_id)
                    color = (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
                
                current = window.get_at((info_panel_width + x, tab_bar_height + y))
                blended = (
                    int(current[0] * 0.65 + color[0] * 0.35),
                    int(current[1] * 0.65 + color[1] * 0.35),
                    int(current[2] * 0.65 + color[2] * 0.35)
                )
                window.set_at((info_panel_width + x, tab_bar_height + y), blended)
        
        # Arêtes des religions désactivées
    
    # Overlay des cultures - avec opacité 40%
    elif display_mode == 'cultures' and hasattr(game_map, 'cultures'):
        for y in range(map_height):
            for x in range(map_width):
                culture_id = int(game_map.cultures[y, x])  # Convertir uint32 vers int
                
                # Ignorer les pixels sans culture (-1)
                if culture_id < 0:
                    continue
                
                # Utiliser la couleur depuis le ReligionSystem si disponible
                if hasattr(game_map, 'religion_system') and culture_id in game_map.religion_system.cultures:
                    color = game_map.religion_system.cultures[culture_id].color
                else:
                    # Fallback: générer une couleur depuis culture_id
                    rng = random.Random(culture_id ^ 777)
                    color = (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
                
                current = window.get_at((info_panel_width + x, tab_bar_height + y))
                blended = (
                    int(current[0] * 0.65 + color[0] * 0.35),
                    int(current[1] * 0.65 + color[1] * 0.35),
                    int(current[2] * 0.65 + color[2] * 0.35)
                )
                window.set_at((info_panel_width + x, tab_bar_height + y), blended)
        
        # Arêtes des cultures désactivées
    
    # Overlay des pays - avec opacité 40%
    elif display_mode == 'countries' and hasattr(game_map, 'region_to_country') and game_map.regions:
        for region_id, region in enumerate(game_map.regions):
            if hasattr(region, 'vertices') and region.vertices and len(region.vertices) >= 3:
                country_color = game_map.get_country_color_for_region(region_id)
                
                try:
                    from skimage.draw import polygon as ski_polygon
                    rr, cc = ski_polygon([v[1] for v in region.vertices], 
                                        [v[0] for v in region.vertices], 
                                        shape=(map_height, map_width))
                    for r, c in zip(rr, cc):
                        if 0 <= r < map_height and 0 <= c < map_width:
                            current = window.get_at((info_panel_width + c, tab_bar_height + r))
                            blended = (
                                int(current[0] * 0.6 + country_color[0] * 0.4),
                                int(current[1] * 0.6 + country_color[1] * 0.4),
                                int(current[2] * 0.6 + country_color[2] * 0.4)
                            )
                            window.set_at((info_panel_width + c, tab_bar_height + r), blended)
                except:
                    pass
        
        # Dessiner les frontières en blanc
        for edge in game_map.region_edges:
            p1, p2 = edge.p1, edge.p2
            regions_sharing_edge = []
            for region_id, region in enumerate(game_map.regions):
                if hasattr(region, 'vertices') and region.vertices:
                    if p1 in region.vertices and p2 in region.vertices:
                        regions_sharing_edge.append(region_id)
            
            if len(regions_sharing_edge) == 2:
                r1_id, r2_id = regions_sharing_edge
                r1_country = game_map.region_to_country.get(r1_id, -1)
                r2_country = game_map.region_to_country.get(r2_id, -1)
                
                if r1_country != r2_country and r1_country >= 0 and r2_country >= 0:
                    try:
                        pygame.draw.line(window, (255, 255, 255), (info_panel_width + p1[0], tab_bar_height + p1[1]), 
                                       (info_panel_width + p2[0], tab_bar_height + p2[1]), 2)
                    except:
                        pass
    
    # Affichage des routes (mode Routes et tous les autres)
    if display_mode in ['terrain', 'routes']:
        for route in game_map.routes:
            if route:
                for pt in route:
                    if isinstance(pt, (tuple, list)) and len(pt) == 2:
                        x, y = int(pt[0]), int(pt[1])
                        if 0 <= x < map_width and 0 <= y < map_height:
                            window.set_at((info_panel_width + x, tab_bar_height + y), (120, 72, 0))
    
    # Affichage des villes (tous les modes sauf terrain pur)
    if display_mode in ['cities', 'countries', 'routes', 'biomes', 'climate'] or display_mode == 'terrain':
        min_score = game_map.cities.get_min_score()
        max_score = game_map.cities.get_max_score()
        for city in game_map.cities.cities:
            if max_score > min_score:
                norm = (city.score - min_score) / (max_score - min_score)
            else:
                norm = 0.5
            rayon = int(1 + 4 * norm)
            
            if getattr(city, 'is_capital', False):
                color = (255, 255, 0)
                rayon = int(rayon * 1.5)
            else:
                color = (255, 0, 0)
            
            pygame.draw.circle(window, color, (info_panel_width + city.position[0], tab_bar_height + city.position[1]), rayon)
            
            if getattr(city, 'is_capital', False):
                pygame.draw.circle(window, (255, 200, 0), (info_panel_width + city.position[0], tab_bar_height + city.position[1]), rayon + 2, 2)

    # ========== PANNEAU D'INFOS SUR LA GAUCHE ==========
    info_panel_rect = pygame.Rect(0, tab_bar_height, info_panel_width, map_height)
    pygame.draw.rect(window, (230, 230, 230), info_panel_rect)
    pygame.draw.line(window, (100, 100, 100), (info_panel_width, tab_bar_height), 
                    (info_panel_width, tab_bar_height + map_height), 2)
    
    small_font = pygame.font.SysFont(None, 14)
    tiny_font = pygame.font.SysFont(None, 14)  # Augmenté de 12 à 14
    
    # Title du tab actif
    tab_name = tab_system.get_active_tab_name()
    title_text = small_font.render(f"[{tab_name}]", True, (0, 0, 0))
    info_panel_rect_title = pygame.Rect(5, tab_bar_height + 5, info_panel_width - 10, 25)
    window.blit(title_text, (info_panel_rect_title.x, info_panel_rect_title.y + 5))
    
    # Infos contextuelles
    y_pos = tab_bar_height + 35
    line_height = 18  # Augmenté de 16 à 18 pour accommoder la plus grande police
    
    # Chercher si la souris est sur une ville
    hovered_city = None
    hovered_country = None
    if 0 <= mx < map_width and 0 <= my < map_height:
        for city in game_map.cities.cities:
            dist = ((city.position[0] - mx)**2 + (city.position[1] - my)**2)**0.5
            if dist <= 8:  # Rayon de détection
                hovered_city = city
                # Récupérer le pays de la ville si elle l'a
                if hasattr(city, 'country') and city.country is not None:
                    hovered_country = game_map.countries.countries.get(city.country)
                break
    
    # Afficher les infos du pays survolé - SEULEMENT sur le tab Countries
    if hovered_country and tab_system.active_tab == 1:  # Tab Countries
        info_texts = []
        info_texts.append(f"[COUNTRY] {hovered_country.name}")
        info_texts.append(f"Population: {hovered_country.population:,}")
        info_texts.append(f"Government: {hovered_country.government}")
        info_texts.append(f"Founded: {hovered_country.year_founded}")
        info_texts.append("")
        info_texts.append(f"Religion: {hovered_country.religion}")
        info_texts.append(f"Culture: {hovered_country.culture}")
        info_texts.append("")
        info_texts.append(f"Cities: {len(hovered_country.cities)}")
        if hovered_country.capital:
            info_texts.append(f"Capital: {hovered_country.capital.name}")
        info_texts.append("")
        info_texts.append(f"Resources:")
        if isinstance(hovered_country.resources, dict):
            for res_type, value in hovered_country.resources.items():
                info_texts.append(f"  {res_type}: {value:.0f}")
        
        # Limiter à 80px de hauteur pour ne pas recouvrir légende
        max_y = tab_bar_height + map_height - 100
        for text in info_texts:
            if y_pos > max_y:
                break
            if text:  # Ne pas afficher les lignes vides
                text_surface = tiny_font.render(text, True, (0, 0, 0))
                window.blit(text_surface, (5, y_pos))
            y_pos += line_height
    # Afficher les infos de la ville survolée - SEULEMENT sur le tab Cities
    elif hovered_city and tab_system.active_tab == 2:  # Tab Cities
        info_texts = []
        info_texts.append(f"[CITY] {hovered_city.name}")
        info_texts.append(f"Pos: {hovered_city.position}")
        info_texts.append(f"Population: {hovered_city.population:,}")
        info_texts.append(f"Type: {hovered_city.city_type}")
        info_texts.append(f"Founded: {hovered_city.founded_year}")
        info_texts.append("")
        info_texts.append(f"Religion: {hovered_city.religion}")
        info_texts.append(f"Culture: {hovered_city.culture}")
        info_texts.append(f"Government: {hovered_city.government}")
        info_texts.append("")
        info_texts.append(f"Resources:")
        if hasattr(hovered_city, 'resources') and isinstance(hovered_city.resources, dict):
            for res_type, value in hovered_city.resources.items():
                info_texts.append(f"  {res_type}: {value:.0f}")
        
        # Limiter à 80px de hauteur pour ne pas recouvrir légende
        max_y = tab_bar_height + map_height - 100
        for text in info_texts:
            if y_pos > max_y:
                break
            if text:  # Ne pas afficher les lignes vides
                text_surface = tiny_font.render(text, True, (0, 0, 0))
                window.blit(text_surface, (5, y_pos))
            y_pos += line_height
    # Afficher les infos de religion survolée - SEULEMENT sur le tab Religions
    elif tab_system.active_tab == 6:  # Tab Religions
        if 0 <= mx < map_width and 0 <= my < map_height:
            religion_id = int(game_map.religions[my, mx])
            if religion_id >= 0 and hasattr(game_map, 'religion_system') and religion_id in game_map.religion_system.religions:
                religion = game_map.religion_system.religions[religion_id]
                info_texts = []
                info_texts.append(f"[RELIGION] {religion.name}")
                info_texts.append(f"Founded: {religion.founding_year}")
                info_texts.append(f"Location: {religion.founding_city}")
                if religion.events:
                    info_texts.append(f"Events: {len(religion.events)}")
                    for event in religion.events[:3]:  # Afficher les 3 premiers événements
                        info_texts.append(f"  - {event.year}: {event.description[:30]}...")
                
                # Limiter à 80px de hauteur pour ne pas recouvrir légende
                max_y = tab_bar_height + map_height - 100
                for text in info_texts:
                    if y_pos > max_y:
                        break
                    if text:
                        text_surface = tiny_font.render(text, True, (0, 0, 0))
                        window.blit(text_surface, (5, y_pos))
                    y_pos += line_height
    # Afficher les infos de culture survolée - SEULEMENT sur le tab Cultures
    elif tab_system.active_tab == 7:  # Tab Cultures
        if 0 <= mx < map_width and 0 <= my < map_height:
            culture_id = int(game_map.cultures[my, mx])
            if culture_id >= 0 and hasattr(game_map, 'religion_system') and culture_id in game_map.religion_system.cultures:
                culture = game_map.religion_system.cultures[culture_id]
                info_texts = []
                info_texts.append(f"[CULTURE] {culture.name}")
                info_texts.append(f"Origin Region: {culture.origin_region_id}")
                info_texts.append(f"Climate Type: {culture.climate_type}")
                info_texts.append(f"Color: RGB{culture.color}")
                if culture.traits:
                    info_texts.append("")
                    info_texts.append("Traits:")
                    for trait_name, trait_value in culture.traits.items():
                        info_texts.append(f"  {trait_name}: {trait_value[:40]}...")
                
                # Limiter à 80px de hauteur pour ne pas recouvrir légende
                max_y = tab_bar_height + map_height - 100
                for text in info_texts:
                    if y_pos > max_y:
                        break
                    if text:
                        text_surface = tiny_font.render(text, True, (0, 0, 0))
                        window.blit(text_surface, (5, y_pos))
                    y_pos += line_height
    elif 0 <= mx < map_width and 0 <= my < map_height:
        info_texts = []
        info_texts.append(f"Pos: ({mx}, {my})")
        info_texts.append(f"Alt: {game_map.map[my, mx]}")
        
        if game_map.climate is not None:
            climate_val = game_map.climate[my, mx]
            info_texts.append(f"Climate: {climate_val}")
        
        if game_map.biomes is not None:
            biome_id = game_map.biomes[my, mx]
            biome_names = {0: "Water", 1: "Beach", 2: "Plain", 3: "Forest", 4: "Prairie",
                         5: "Desert", 6: "Hills", 7: "Mountain", 8: "Peak", 9: "Jungle", 10: "Swamp"}
            biome_name = biome_names.get(biome_id, f"Biome {biome_id}")
            info_texts.append(f"Biome: {biome_name}")
        
        for text in info_texts:
            text_surface = tiny_font.render(text, True, (0, 0, 0))
            window.blit(text_surface, (5, y_pos))
            y_pos += line_height
    
    # ========== LÉGENDES ==========
    # Légende Biomes
    if display_mode == 'biomes':
        y_pos = tab_bar_height + 120
        legend_title = small_font.render("Biomes:", True, (0, 0, 0))
        window.blit(legend_title, (5, y_pos))
        y_pos += line_height + 5
        
        biome_names = {
            0: "Water", 1: "Beach", 2: "Plain", 3: "Forest", 4: "Prairie",
            5: "Desert", 6: "Hills", 7: "Mountain", 8: "Peak", 9: "Jungle", 10: "Swamp"
        }
        
        for i in range(len(BIOME_COLORS)):
            if y_pos + 12 > tab_bar_height + map_height - 20:  # Pas assez de place
                break
            
            color = BIOME_COLORS.get(i, (128, 128, 128))
            name = biome_names.get(i, f"Biome {i}")
            
            # Petit carré de couleur
            pygame.draw.rect(window, color, (5, y_pos, 12, 12))
            pygame.draw.rect(window, (0, 0, 0), (5, y_pos, 12, 12), 1)
            
            # Nom du biome
            name_text = tiny_font.render(name, True, (0, 0, 0))
            window.blit(name_text, (20, y_pos - 2))
            y_pos += line_height
    
    # Légende Climat
    elif display_mode == 'climate':
        y_pos = tab_bar_height + 120
        legend_title = small_font.render("Climate:", True, (0, 0, 0))
        window.blit(legend_title, (5, y_pos))
        y_pos += line_height + 5
        
        climate_ranges = [
            (0, "Polar"),
            (85, "Cold"),
            (127, "Temperate"),
            (170, "Tropical"),
            (210, "Desert")
        ]
        
        for value, label in climate_ranges:
            if y_pos + 12 > tab_bar_height + map_height - 20:
                break
            
            color = get_climate_color(value)
            
            # Petit carré de couleur
            pygame.draw.rect(window, color, (5, y_pos, 12, 12))
            pygame.draw.rect(window, (0, 0, 0), (5, y_pos, 12, 12), 1)
            
            # Label
            label_text = tiny_font.render(label, True, (0, 0, 0))
            window.blit(label_text, (20, y_pos - 2))
            y_pos += line_height
    
    # Légende Religions
    elif display_mode == 'religions':
        y_pos = tab_bar_height + 120
        legend_title = small_font.render("Religions Fondamentales:", True, (0, 0, 0))
        window.blit(legend_title, (5, y_pos))
        y_pos += line_height + 5
        
        # Afficher les religions fondamentales (pas toutes les régions!)
        religion_names_to_show = game_map.religion_names_foundational if hasattr(game_map, 'religion_names_foundational') else {}
        
        for religion_id, religion_name in sorted(religion_names_to_show.items()):
            if y_pos + 12 > tab_bar_height + map_height - 20:
                break
            
            # Couleur basée sur religion_id
            rng = random.Random(religion_id)
            color = (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
            
            # Petit carré de couleur
            pygame.draw.rect(window, color, (5, y_pos, 12, 12))
            pygame.draw.rect(window, (0, 0, 0), (5, y_pos, 12, 12), 1)
            
            # Nom de la religion (raccourci si trop long)
            display_name = religion_name
            name_text = tiny_font.render(display_name, True, (0, 0, 0))
            window.blit(name_text, (20, y_pos - 2))
            y_pos += line_height
    
    # Légende Cultures
    elif display_mode == 'cultures':
        y_pos = tab_bar_height + 120
        legend_title = small_font.render("Cultures Majeures:", True, (0, 0, 0))
        window.blit(legend_title, (5, y_pos))
        y_pos += line_height + 5
        
        # Afficher seulement les cultures majeures (pas toutes les régions!)
        culture_names_to_show = game_map.culture_names_major if hasattr(game_map, 'culture_names_major') else {}
        
        for region_id, culture_name in sorted(culture_names_to_show.items()):
            if y_pos + 12 > tab_bar_height + map_height - 20:
                break
            
            # Couleur basée sur region_id avec offset
            rng = random.Random(region_id ^ 777)
            color = (rng.randint(50, 200), rng.randint(50, 200), rng.randint(50, 200))
            
            # Petit carré de couleur
            pygame.draw.rect(window, color, (5, y_pos, 12, 12))
            pygame.draw.rect(window, (0, 0, 0), (5, y_pos, 12, 12), 1)
            
            # Nom de la culture
            display_name = culture_name
            name_text = tiny_font.render(display_name, True, (0, 0, 0))
            window.blit(name_text, (20, y_pos - 2))
            y_pos += line_height

    # ========== BARRE D'INFO EN BAS ==========
    # Remplir la barre d'info avec une couleur de fond
    info_bar_rect = pygame.Rect(0, tab_bar_height + map_height, total_width, info_bar_height)
    pygame.draw.rect(window, (220, 220, 220), info_bar_rect)
    pygame.draw.line(window, (100, 100, 100), (0, tab_bar_height + map_height), (total_width, tab_bar_height + map_height), 2)
    
    # Initialiser police plus petite pour l'info
    small_font = pygame.font.SysFont(None, 18)
    
    # Info gauche : Coordonnées et altitude
    if mouse_value is not None:
        coord_text = f"({mx:3d}, {my:3d}) Alt: {mouse_value:3d}"
    else:
        coord_text = "Hors de la carte"
    coord_surface = small_font.render(coord_text, True, (0, 0, 0))
    window.blit(coord_surface, (10, tab_bar_height + map_height + 5))
    
    # Info centre : Pays et villes
    if hasattr(game_map, 'countries'):
        num_countries = game_map.countries.get_num_countries()
        num_cities = len(game_map.cities.cities)
        center_text = f"Pays: {num_countries:2d}  |  Villes: {num_cities:2d}  |  Routes: {len(game_map.routes):3d}"
        center_surface = small_font.render(center_text, True, (0, 0, 0))
        center_rect = center_surface.get_rect(center=(total_width // 2, tab_bar_height + map_height + 16))
        window.blit(center_surface, center_rect)
    
    # Info droite : Commandes
    commands = ["[ENTER] Regen", "[S] Screenshot"]
    commands_text = "  |  ".join(commands)
    commands_surface = small_font.render(commands_text, True, (50, 50, 150))
    commands_rect = commands_surface.get_rect(bottomright=(total_width - 10, tab_bar_height + map_height + info_bar_height - 5))
    window.blit(commands_surface, commands_rect)
    
    # ========== DESSINER LES TABS ==========
    tab_system.draw(window, small_font)

    pygame.display.flip()

pygame.quit()