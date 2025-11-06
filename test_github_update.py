#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de test pour vérifier le système de mise à jour GitHub.
"""

import sys
import json
import requests
from calmweb.utils.app_updater import AppUpdater


def test_github_connection():
    """Test de connexion au repo GitHub."""
    print("Test de connexion au repo GitHub 'ostend972/test'")
    print("=" * 60)

    updater = AppUpdater("ostend972/test")

    try:
        # Test de l'API GitHub
        print(f"URL API: {updater.github_api_url}")

        headers = {'User-Agent': f'CalmWeb/{updater.current_version}'}
        response = requests.get(updater.github_api_url, headers=headers, timeout=10)

        print(f"Statut de la reponse: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("Connexion reussie au repo GitHub")
            print(f"Derniere release: {data.get('tag_name', 'N/A')}")
            print(f"Date de publication: {data.get('published_at', 'N/A')}")
            print(f"Nom de la release: {data.get('name', 'N/A')}")

            # Afficher les assets
            assets = data.get('assets', [])
            print(f"Nombre d'assets: {len(assets)}")

            for i, asset in enumerate(assets):
                print(f"  {i+1}. {asset['name']} ({asset['size']} bytes)")
                print(f"     URL: {asset['browser_download_url']}")

            # Tester la recherche d'executable Windows
            exe_asset = None
            for asset in assets:
                if asset['name'].endswith('.exe'):
                    exe_asset = asset
                    break

            if exe_asset:
                print(f"Executable Windows trouve: {exe_asset['name']}")
                print(f"Taille: {exe_asset['size']} bytes")
            else:
                print("Aucun executable Windows (.exe) trouve dans les assets")

        elif response.status_code == 404:
            print("Repo introuvable ou aucune release publiee")
        else:
            print(f"Erreur HTTP: {response.status_code}")
            print(f"Response: {response.text}")

    except Exception as e:
        print(f"Erreur de connexion: {e}")

    print()
    print("Test du systeme de mise a jour CalmWeb")
    print("-" * 40)

    try:
        # Test avec l'updater CalmWeb
        status = updater.get_status()
        print(f"Version actuelle: {status['current_version']}")

        print("Verification des mises a jour...")
        update_available = updater.check_for_updates()

        new_status = updater.get_status()
        print(f"Statut: {new_status['status']}")
        print(f"Mise a jour disponible: {'Oui' if update_available else 'Non'}")

        if new_status.get('available_version'):
            print(f"Version disponible: {new_status['available_version']}")

        if new_status.get('error'):
            print(f"Erreur: {new_status['error']}")

    except Exception as e:
        print(f"Erreur lors du test de mise a jour: {e}")

    print()
    print("Test termine!")


if __name__ == "__main__":
    test_github_connection()