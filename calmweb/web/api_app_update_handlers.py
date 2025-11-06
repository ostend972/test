#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
API handlers for application updates.
Provides REST endpoints for the dashboard to control app updates.
"""

import json
from http.server import BaseHTTPRequestHandler
from typing import Dict, Any

from ..utils.logging import log
from ..utils.app_updater import app_updater


def handle_app_update_status(handler: BaseHTTPRequestHandler, path_params: Dict[str, Any] = None):
    """Handle GET /api/app-update/status - Get current app update status."""
    if handler.command != 'GET':
        handler.send_error(405, "Method not allowed")
        return

    try:
        status = app_updater.get_status()

        handler.send_response(200)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        response = {
            "success": True,
            "data": status
        }

        handler.wfile.write(json.dumps(response, indent=2).encode())
        log(f"App update status sent: {status['status']}")

    except Exception as e:
        error_msg = f"Error getting app update status: {e}"
        log(error_msg)

        handler.send_response(500)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        error_response = {
            "success": False,
            "error": error_msg
        }

        handler.wfile.write(json.dumps(error_response).encode())


def handle_app_update_check(handler: BaseHTTPRequestHandler, path_params: Dict[str, Any] = None):
    """Handle POST /api/app-update/check - Manually trigger update check."""
    if handler.command != 'POST':
        handler.send_error(405, "Method not allowed")
        return

    try:
        log("Manual app update check requested")

        # Trigger update check
        update_available = app_updater.force_update_check()

        handler.send_response(200)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        # Get updated status
        status = app_updater.get_status()

        response = {
            "success": True,
            "data": {
                "update_available": update_available,
                "status": status
            },
            "message": "Update check completed"
        }

        handler.wfile.write(json.dumps(response, indent=2).encode())
        log(f"Manual update check completed: {'Update available' if update_available else 'No update available'}")

    except Exception as e:
        error_msg = f"Error checking for app updates: {e}"
        log(error_msg)

        handler.send_response(500)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        error_response = {
            "success": False,
            "error": error_msg
        }

        handler.wfile.write(json.dumps(error_response).encode())


def handle_app_update_install(handler: BaseHTTPRequestHandler, path_params: Dict[str, Any] = None):
    """Handle POST /api/app-update/install - Manually trigger update installation."""
    if handler.command != 'POST':
        handler.send_error(405, "Method not allowed")
        return

    try:
        log("Manual app update installation requested")

        # Trigger update installation
        success = app_updater.force_update_install()

        handler.send_response(200)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        # Get updated status
        status = app_updater.get_status()

        response = {
            "success": success,
            "data": {
                "installation_started": success,
                "status": status
            },
            "message": "Update installation started" if success else "No update to install or installation failed"
        }

        handler.wfile.write(json.dumps(response, indent=2).encode())
        log(f"Manual update installation: {'Started' if success else 'Failed or no update available'}")

    except Exception as e:
        error_msg = f"Error installing app update: {e}"
        log(error_msg)

        handler.send_response(500)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()

        error_response = {
            "success": False,
            "error": error_msg
        }

        handler.wfile.write(json.dumps(error_response).encode())


def handle_app_update_settings(handler: BaseHTTPRequestHandler, path_params: Dict[str, Any] = None):
    """Handle GET/POST /api/app-update/settings - Get or update auto-update settings."""
    if handler.command == 'GET':
        try:
            handler.send_response(200)
            handler.send_header('Content-Type', 'application/json')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.end_headers()

            status = app_updater.get_status()

            response = {
                "success": True,
                "data": {
                    "auto_check_enabled": app_updater._update_thread is not None and app_updater._update_thread.is_alive(),
                    "check_interval_hours": status.get("check_interval_hours", 1),
                    "github_repo": app_updater.github_repo
                }
            }

            handler.wfile.write(json.dumps(response, indent=2).encode())

        except Exception as e:
            error_msg = f"Error getting app update settings: {e}"
            log(error_msg)

            handler.send_response(500)
            handler.send_header('Content-Type', 'application/json')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.end_headers()

            error_response = {
                "success": False,
                "error": error_msg
            }

            handler.wfile.write(json.dumps(error_response).encode())

    elif handler.command == 'POST':
        try:
            content_length = int(handler.headers.get('Content-Length', 0))
            post_data = handler.rfile.read(content_length)
            data = json.loads(post_data.decode())

            auto_check_enabled = data.get('auto_check_enabled')

            if auto_check_enabled is not None:
                if auto_check_enabled:
                    app_updater.start_auto_check()
                else:
                    app_updater.stop_auto_check()

            handler.send_response(200)
            handler.send_header('Content-Type', 'application/json')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.end_headers()

            response = {
                "success": True,
                "message": "Settings updated successfully",
                "data": {
                    "auto_check_enabled": app_updater._update_thread is not None and app_updater._update_thread.is_alive()
                }
            }

            handler.wfile.write(json.dumps(response, indent=2).encode())
            log(f"App update settings updated: auto_check_enabled={auto_check_enabled}")

        except Exception as e:
            error_msg = f"Error updating app update settings: {e}"
            log(error_msg)

            handler.send_response(500)
            handler.send_header('Content-Type', 'application/json')
            handler.send_header('Access-Control-Allow-Origin', '*')
            handler.end_headers()

            error_response = {
                "success": False,
                "error": error_msg
            }

            handler.wfile.write(json.dumps(error_response).encode())

    else:
        handler.send_error(405, "Method not allowed")