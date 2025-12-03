#!/usr/bin/env python3
"""
Test simple de la nouvelle génération des pays par propagation d'influence.
"""

import sys
sys.path.insert(0, r'c:\Users\louise.rojon\Documents\Perso\RPyG\map')

try:
    print("✓ Importation des modules...")
    from map import Map
    from country import Countries, Country
    from city import Cities
    
    print("✓ Initialisation de la carte...")
    game_map = Map(200, 200, seed=12345)  # Petite map pour test rapide
    
    print(f"✓ Carte générée:")
    print(f"  - Villes: {len(game_map.cities.cities)}")
    print(f"  - Régions: {len(game_map.regions)}")
    print(f"  - Pays: {len(game_map.countries.countries)}")
    
    print(f"\n✓ Détails des pays:")
    for country_id, country in sorted(game_map.countries.countries.items()):
        if country:
            capital_name = country.capital.name if country.capital else "Aucune"
            print(f"  {country.name:20} - Capitale: {capital_name:15} | Régions: {len(country.regions):3} | Score: {country.capital.score if country.capital else 0:.1f}")
    
    print("\n✅ Test réussi! La génération par propagation d'influence fonctionne.")
    
except Exception as e:
    print(f"\n❌ ERREUR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
