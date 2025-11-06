#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Application auto-updater for CalmWeb.
Handles automatic updates from GitHub releases.
"""

import os
import sys
import json
import requests
import subprocess
import tempfile
import threading
import time
import datetime
import hashlib
from typing import Dict, Any, Optional, Tuple
from packaging import version

from .logging import log
from ..config.settings import CALMWEB_VERSION, INSTALL_DIR, EXE_NAME


class AppUpdater:
    """Manages automatic application updates from GitHub."""

    def __init__(self, github_repo: str = "ostend972/test"):
        self.github_repo = github_repo
        self.current_version = CALMWEB_VERSION
        self.github_api_url = f"https://api.github.com/repos/{github_repo}/releases/latest"

        self._update_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._check_interval = 3600  # 1 hour
        self._last_check: Optional[datetime.datetime] = None
        self._update_status = "idle"  # idle, checking, downloading, installing, success, error
        self._update_error: Optional[str] = None
        self._lock = threading.RLock()
        self._available_version: Optional[str] = None
        self._download_url: Optional[str] = None

        # Status file to persist update information
        self._status_file = os.path.join(
            os.path.expanduser("~"), "AppData", "Roaming", "CalmWeb", "app_update_status.json"
        )

        self._load_status()

    def _load_status(self):
        """Load update status from file."""
        try:
            if os.path.exists(self._status_file):
                with open(self._status_file, 'r') as f:
                    data = json.load(f)

                if 'last_check' in data and data['last_check']:
                    self._last_check = datetime.datetime.fromisoformat(data['last_check'])

                self._update_status = data.get('status', 'idle')
                self._update_error = data.get('error', None)
                self._available_version = data.get('available_version', None)
                self._download_url = data.get('download_url', None)

                log(f"App update status loaded: last check {self._last_check}")
        except Exception as e:
            log(f"Error loading app update status: {e}")

    def _save_status(self):
        """Save update status to file."""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self._status_file), exist_ok=True)

            data = {
                'status': self._update_status,
                'error': self._update_error,
                'last_check': self._last_check.isoformat() if self._last_check else None,
                'available_version': self._available_version,
                'download_url': self._download_url,
                'current_version': self.current_version
            }

            with open(self._status_file, 'w') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            log(f"Error saving app update status: {e}")

    def start_auto_check(self):
        """Start the automatic update check thread."""
        if self._update_thread and self._update_thread.is_alive():
            log("App updater already running")
            return

        self._stop_event.clear()
        self._update_thread = threading.Thread(
            target=self._update_loop,
            name="AppUpdater",
            daemon=True
        )
        self._update_thread.start()
        log("🔄 App auto-updater started (1 hour interval)")

    def stop_auto_check(self):
        """Stop the automatic update check thread."""
        if self._update_thread:
            self._stop_event.set()
            self._update_thread.join(timeout=5)
            log("🛑 App auto-updater stopped")

    def _update_loop(self):
        """Main update loop running in background thread."""
        while not self._stop_event.is_set():
            try:
                # Check if it's time to check for updates
                now = datetime.datetime.now()

                if self._should_check_for_updates(now):
                    log("⏰ Time for automatic update check")
                    if self.check_for_updates():
                        # If update is available, start silent download and installation
                        if self._available_version and self._is_newer_version(self._available_version):
                            log(f"📥 New version {self._available_version} found, starting silent update")
                            self.download_and_install_update()

                # Wait for next check (every 10 minutes to be responsive)
                if self._stop_event.wait(600):  # 10 minutes
                    break

            except Exception as e:
                log(f"Error in app update loop: {e}")
                # Continue running even if there's an error
                if self._stop_event.wait(600):
                    break

    def _should_check_for_updates(self, now: datetime.datetime) -> bool:
        """Check if it's time to check for updates."""
        if self._last_check is None:
            return True  # First check

        time_since_check = now - self._last_check
        return time_since_check.total_seconds() >= self._check_interval

    def should_check_at_startup(self) -> bool:
        """Check if we should check for updates at startup (avoid too frequent checks)."""
        if self._last_check is None:
            return True  # Never checked before

        now = datetime.datetime.now()
        time_since_check = now - self._last_check
        # Only check at startup if last check was more than 10 minutes ago
        return time_since_check.total_seconds() >= 600  # 10 minutes

    def check_for_updates(self) -> bool:
        """Check GitHub for available updates."""
        with self._lock:
            if self._update_status == "checking":
                log("Update check already in progress")
                return False

            self._update_status = "checking"
            self._update_error = None
            self._save_status()

        try:
            log("🔍 Checking for application updates...")

            # Make request to GitHub API with proxy bypass
            headers = {'User-Agent': f'CalmWeb/{self.current_version}'}

            # Bypass CalmWeb's own proxy for GitHub API access
            import os
            original_http_proxy = os.environ.get('HTTP_PROXY')
            original_https_proxy = os.environ.get('HTTPS_PROXY')

            # Temporarily disable proxy for this request
            if 'HTTP_PROXY' in os.environ:
                del os.environ['HTTP_PROXY']
            if 'HTTPS_PROXY' in os.environ:
                del os.environ['HTTPS_PROXY']

            try:
                response = requests.get(self.github_api_url, headers=headers, timeout=30)
                response.raise_for_status()
            finally:
                # Restore original proxy settings
                if original_http_proxy:
                    os.environ['HTTP_PROXY'] = original_http_proxy
                if original_https_proxy:
                    os.environ['HTTPS_PROXY'] = original_https_proxy

            release_data = response.json()

            latest_version = release_data.get('tag_name', '').lstrip('v')

            if not latest_version:
                raise Exception("No version found in release data")

            # Find the Windows executable in assets
            download_url = None
            for asset in release_data.get('assets', []):
                if asset['name'].endswith('.exe') and 'windows' in asset['name'].lower():
                    download_url = asset['browser_download_url']
                    break

            if not download_url:
                # Fallback: look for any .exe file
                for asset in release_data.get('assets', []):
                    if asset['name'].endswith('.exe'):
                        download_url = asset['browser_download_url']
                        break

            if not download_url:
                raise Exception("No Windows executable found in release assets")

            with self._lock:
                self._available_version = latest_version
                self._download_url = download_url
                self._last_check = datetime.datetime.now()
                self._update_status = "idle"
                self._update_error = None
                self._save_status()

            is_newer = self._is_newer_version(latest_version)

            if is_newer:
                log(f"✨ New version available: {latest_version} (current: {self.current_version})")
            else:
                log(f"✅ Application is up to date (version {self.current_version})")

            return is_newer

        except Exception as e:
            error_msg = f"Update check error: {e}"
            log(f"❌ {error_msg}")

            with self._lock:
                self._update_status = "error"
                self._update_error = error_msg
                self._save_status()

            return False

    def _is_newer_version(self, available_version: str) -> bool:
        """Check if the available version is newer than current."""
        try:
            current_ver = version.parse(self.current_version)
            available_ver = version.parse(available_version)
            return available_ver > current_ver
        except Exception as e:
            log(f"Error comparing versions: {e}")
            return False

    def download_and_install_update(self) -> bool:
        """Download and install the update silently."""
        if not self._download_url or not self._available_version:
            log("❌ No download URL or version available")
            return False

        with self._lock:
            if self._update_status in ["downloading", "installing"]:
                log("Update already in progress")
                return False

            self._update_status = "downloading"
            self._update_error = None
            self._save_status()

        temp_file = None

        try:
            log(f"📥 Downloading update {self._available_version}...")

            # Download to temporary file with proxy bypass
            headers = {'User-Agent': f'CalmWeb/{self.current_version}'}

            # Bypass CalmWeb's own proxy for download
            import os
            original_http_proxy = os.environ.get('HTTP_PROXY')
            original_https_proxy = os.environ.get('HTTPS_PROXY')

            # Temporarily disable proxy for this request
            if 'HTTP_PROXY' in os.environ:
                del os.environ['HTTP_PROXY']
            if 'HTTPS_PROXY' in os.environ:
                del os.environ['HTTPS_PROXY']

            try:
                response = requests.get(self._download_url, headers=headers, stream=True, timeout=300)
                response.raise_for_status()
            finally:
                # Restore original proxy settings
                if original_http_proxy:
                    os.environ['HTTP_PROXY'] = original_http_proxy
                if original_https_proxy:
                    os.environ['HTTPS_PROXY'] = original_https_proxy

            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.exe') as f:
                temp_file = f.name

                total_size = int(response.headers.get('content-length', 0))
                downloaded = 0

                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            if downloaded % (1024 * 1024) == 0:  # Log every MB
                                log(f"📥 Download progress: {progress:.1f}%")

            log("✅ Download completed, starting installation...")

            # Update status to installing
            with self._lock:
                self._update_status = "installing"
                self._save_status()

            # Install the update
            success = self._install_update(temp_file)

            with self._lock:
                if success:
                    self._update_status = "success"
                    self._update_error = None
                    log(f"✅ Update to version {self._available_version} completed successfully")
                else:
                    self._update_status = "error"
                    self._update_error = "Installation failed"
                    log("❌ Update installation failed")

                self._save_status()

            return success

        except Exception as e:
            error_msg = f"Update download/install error: {e}"
            log(f"❌ {error_msg}")

            with self._lock:
                self._update_status = "error"
                self._update_error = error_msg
                self._save_status()

            return False

        finally:
            # Clean up temporary file
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass

    def _install_update(self, temp_file: str) -> bool:
        """Install the downloaded update."""
        try:
            # Get current executable path
            current_exe = os.path.join(INSTALL_DIR, EXE_NAME)
            new_exe = os.path.join(INSTALL_DIR, f"{EXE_NAME}.new")

            # Copy new executable to .new file (while current is still running)
            import shutil
            shutil.copy2(temp_file, new_exe)
            log("📁 New executable copied to .new file")

            # Verify the new executable
            if not os.path.exists(new_exe):
                raise Exception("New executable not found after copy")

            # Test the new executable
            try:
                result = subprocess.run([new_exe, "--version"],
                                      capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    raise Exception(f"New executable test failed: {result.stderr}")
                log("✅ New executable verified")
            except subprocess.TimeoutExpired:
                log("⚠️ New executable test timed out, assuming OK")
            except Exception as e:
                log(f"⚠️ Could not verify new executable: {e}")

            # Schedule restart of CalmWeb with file replacement
            self._schedule_restart_with_replacement()

            return True

        except Exception as e:
            log(f"❌ Installation failed: {e}")

            # Clean up new file if installation failed
            new_exe = os.path.join(INSTALL_DIR, f"{EXE_NAME}.new")
            if os.path.exists(new_exe):
                try:
                    os.remove(new_exe)
                    log("🧹 Failed new executable cleaned up")
                except Exception:
                    pass

            return False

    def _schedule_restart_with_replacement(self):
        """Schedule a restart of CalmWeb with file replacement."""
        try:
            # Create a batch script to replace file and restart CalmWeb
            restart_script = os.path.join(tempfile.gettempdir(), "calmweb_update_restart.bat")
            current_exe = os.path.join(INSTALL_DIR, EXE_NAME)
            new_exe = os.path.join(INSTALL_DIR, f"{EXE_NAME}.new")
            backup_exe = os.path.join(INSTALL_DIR, f"{EXE_NAME}.backup")

            script_content = f"""@echo off
REM Silent CalmWeb update script - NO OUTPUT
timeout /t 3 /nobreak >nul

REM Stop CalmWeb process silently
taskkill /f /im "{EXE_NAME}" >nul 2>&1
timeout /t 2 /nobreak >nul

REM Backup current executable silently
if exist "{current_exe}" (
    if exist "{backup_exe}" del "{backup_exe}" >nul 2>&1
    ren "{current_exe}" "{EXE_NAME}.backup" >nul 2>&1
)

REM Replace with new version silently
if exist "{new_exe}" (
    ren "{new_exe}" "{EXE_NAME}" >nul 2>&1
) else (
    REM Restore backup if new version missing
    if exist "{backup_exe}" (
        ren "{backup_exe}" "{EXE_NAME}" >nul 2>&1
    )
    goto end
)

REM Start new version silently
timeout /t 2 /nobreak >nul
start /min "" "{current_exe}" >nul 2>&1

REM Clean up backup after delay
timeout /t 5 /nobreak >nul
if exist "{backup_exe}" del "{backup_exe}" >nul 2>&1

:end
REM Self-destruct silently
del "%~f0" >nul 2>&1
"""

            with open(restart_script, 'w') as f:
                f.write(script_content)

            # Start the restart script completely silently
            subprocess.Popen([restart_script], shell=True,
                           creationflags=subprocess.CREATE_NO_WINDOW,
                           stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)

            log("🔄 Update restart scheduled - will stop current process and replace executable")

        except Exception as e:
            log(f"⚠️ Could not schedule update restart: {e}")

    def _schedule_restart(self):
        """Schedule a simple restart of CalmWeb (legacy method)."""
        try:
            # Create a batch script to restart CalmWeb after a delay
            restart_script = os.path.join(tempfile.gettempdir(), "calmweb_restart.bat")
            current_exe = os.path.join(INSTALL_DIR, EXE_NAME)

            script_content = f"""@echo off
echo Restarting CalmWeb...
timeout /t 5 /nobreak >nul
taskkill /f /im "{EXE_NAME}" >nul 2>&1
timeout /t 3 /nobreak >nul
start "" "{current_exe}"
del "%~f0"
"""

            with open(restart_script, 'w') as f:
                f.write(script_content)

            # Start the restart script
            subprocess.Popen([restart_script], shell=True,
                           creationflags=subprocess.CREATE_NO_WINDOW)

            log("🔄 Restart scheduled for 8 seconds")

        except Exception as e:
            log(f"⚠️ Could not schedule restart: {e}")

    def get_status(self) -> Dict[str, Any]:
        """Get current update status for dashboard."""
        with self._lock:
            return {
                "status": self._update_status,
                "current_version": self.current_version,
                "available_version": self._available_version,
                "last_check": self._last_check.isoformat() if self._last_check else None,
                "last_check_human": self._format_time_ago(self._last_check) if self._last_check else "Never",
                "error": self._update_error,
                "update_available": (
                    self._available_version is not None and
                    self._is_newer_version(self._available_version)
                ),
                "download_url": self._download_url,
                "check_interval_hours": self._check_interval / 3600
            }

    def _format_time_ago(self, timestamp: datetime.datetime) -> str:
        """Format time difference in human readable format."""
        now = datetime.datetime.now()
        diff = now - timestamp

        if diff.total_seconds() < 60:
            return "Just now"
        elif diff.total_seconds() < 3600:
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif diff.total_seconds() < 86400:
            hours = int(diff.total_seconds() / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        else:
            days = int(diff.total_seconds() / 86400)
            return f"{days} day{'s' if days != 1 else ''} ago"

    def force_update_check(self) -> bool:
        """Manually trigger an update check."""
        return self.check_for_updates()

    def force_update_install(self) -> bool:
        """Manually trigger update download and installation."""
        if self._available_version and self._is_newer_version(self._available_version):
            return self.download_and_install_update()
        else:
            log("No update available to install")
            return False


# Global instance
app_updater = AppUpdater()