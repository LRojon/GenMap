#!/usr/bin/env python3
"""Script de test pour vérifier la propagation cohérente des cultures."""

import sys
import time
from map import Map

# Créer une seed fixe pour reproductibilité
seed = 12345

print(f"🗺️ Génération de la carte avec seed={seed}...")
start = time.time()

try:
    # Créer la map
    m = Map(400, 400, seed)
    
    elapsed = time.time() - start
    print(f"✅ Map générée en {elapsed:.2f}s")
    
    # Vérifier les religions et cultures
    if hasattr(m, 'religion_system'):
        rs = m.religion_system
        
        print(f"\n📊 Statistiques:")
        print(f"  - Religions: {len(rs.religions)}")
        print(f"  - Cultures: {len(rs.cultures)}")
        
        if hasattr(rs, 'region_to_culture'):
            print(f"  - Régions avec culture assignée: {len(rs.region_to_culture)}")
            
            # Analyser la distribution
            culture_regions_count = {}
            for region_id, culture_id in rs.region_to_culture.items():
                if culture_id not in culture_regions_count:
                    culture_regions_count[culture_id] = 0
                culture_regions_count[culture_id] += 1
            
            print(f"\n🎭 Distribution des cultures par région:")
            for culture_id, count in sorted(culture_regions_count.items(), key=lambda x: -x[1]):
                culture = rs.cultures.get(culture_id)
                if culture:
                    print(f"  - {culture.name}: {count} régions")
        
        if hasattr(m, 'countries'):
            print(f"\n🏛️ Pays générés: {len(m.countries.countries)}")
    
    print("\n✅ Test réussi!")
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
