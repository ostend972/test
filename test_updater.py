#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de test pour le système de mise à jour automatique de CalmWeb.
"""

import sys
import time
from calmweb.utils.app_updater import app_updater


def test_update_system():
    """Test le système de mise à jour."""
    print("🔍 Test du système de mise à jour de CalmWeb")
    print("=" * 50)

    # Afficher la version actuelle
    print(f"📱 Version actuelle: {app_updater.current_version}")
    print(f"🌐 Dépôt GitHub: {app_updater.github_repo}")
    print()

    # Test 1: Vérifier les mises à jour
    print("🔍 Test 1: Vérification des mises à jour...")
    try:
        update_available = app_updater.check_for_updates()
        status = app_updater.get_status()

        print(f"✅ Vérification réussie")
        print(f"📋 Statut: {status['status']}")
        print(f"🎯 Mise à jour disponible: {'Oui' if update_available else 'Non'}")

        if status.get('available_version'):
            print(f"📦 Version disponible: {status['available_version']}")
            print(f"🔗 URL de téléchargement: {status['download_url']}")

        if status.get('error'):
            print(f"❌ Erreur: {status['error']}")

    except Exception as e:
        print(f"❌ Erreur lors de la vérification: {e}")

    print()

    # Test 2: Afficher le statut complet
    print("📊 Test 2: Statut complet du système...")
    try:
        status = app_updater.get_status()

        print("📋 Statut complet:")
        for key, value in status.items():
            if key != 'download_url' or value:  # Ne pas afficher l'URL si elle est vide
                print(f"  {key}: {value}")

    except Exception as e:
        print(f"❌ Erreur lors de l'obtention du statut: {e}")

    print()

    # Test 3: Test de la comparaison de versions
    print("🔢 Test 3: Comparaison de versions...")
    test_versions = [
        ("1.0.0", "1.0.1", True),
        ("1.1.0", "1.0.9", False),
        ("2.0.0", "1.9.9", False),
        ("1.0.0-beta", "1.0.0", True),
    ]

    for current, available, expected in test_versions:
        app_updater.current_version = current
        result = app_updater._is_newer_version(available)
        status = "✅" if result == expected else "❌"
        print(f"  {status} {current} -> {available}: {'Plus récent' if result else 'Pas plus récent'}")

    # Restaurer la version originale
    from calmweb.config.settings import CALMWEB_VERSION
    app_updater.current_version = CALMWEB_VERSION

    print()
    print("🎉 Tests terminés!")


if __name__ == "__main__":
    test_update_system()