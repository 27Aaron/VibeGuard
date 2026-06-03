#!/usr/bin/env python3
"""VibeGuard preflight probe.

Read-only checks before the full scanner:
  1. Detect supported project dependency files.
  2. Detect OS family / Linux distribution.
  3. Detect supported package managers without running update checks.

The script prints JSON to stdout and writes the same JSON to a temp file by
default. It uses only Python standard library modules.
"""

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import sys
import tempfile
import time

from scan import LOCKFILE_MAP, find_project_root

PACKAGE_MANAGER_SPECS = {
    "macos": [
        {
            "name": "brew",
            "command": "brew",
            "update_check_command": ["brew", "outdated"],
        },
    ],
    "linux": [
        {
            "name": "apt",
            "command": "apt",
            "update_check_command": ["apt", "list", "--upgradable"],
        },
        {
            "name": "dnf",
            "command": "dnf",
            "update_check_command": ["dnf", "check-update"],
        },
        {
            "name": "yum",
            "command": "yum",
            "update_check_command": ["yum", "check-update"],
        },
        {
            "name": "pacman",
            "command": "pacman",
            "update_check_command": ["pacman", "-Qu"],
        },
        {
            "name": "apk",
            "command": "apk",
            "update_check_command": ["apk", "version", "-l", "<"],
        },
        {
            "name": "nix",
            "command": "nix",
            "update_check_command": ["nix", "profile", "upgrade", "--all", "--dry-run"],
        },
    ],
    "windows": [
        {
            "name": "winget",
            "command": "winget",
            "update_check_command": ["winget", "upgrade"],
        },
        {
            "name": "scoop",
            "command": "scoop",
            "update_check_command": ["scoop", "status"],
        },
    ],
}

SYSTEM_UPDATE_TOOL_SPECS = {
    "macos": [
        {
            "name": "softwareupdate",
            "command": "softwareupdate",
            "update_check_command": ["softwareupdate", "--list"],
        },
    ],
    "linux": [],
    "windows": [],
}


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Run VibeGuard preflight checks")
    parser.add_argument("project_path", nargs="?", default=".")
    parser.add_argument(
        "--no-root-discovery",
        action="store_true",
        help="use the supplied path exactly instead of walking up to the project root",
    )
    parser.add_argument(
        "--output",
        help="write JSON to this path instead of the default temp-file path",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="emit compact JSON instead of pretty-printed JSON",
    )
    parser.add_argument(
        "--platform",
        choices=["auto", "macos", "linux", "windows"],
        default="auto",
        help=argparse.SUPPRESS,
    )
    parser.add_argument("--os-release-file", help=argparse.SUPPRESS)
    parser.add_argument("--path-env", help=argparse.SUPPRESS)
    return parser.parse_args(argv)


def safe_filename(value):
    value = re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-")
    return value or "project"


def default_temp_dir(family):
    if family == "windows":
        return os.environ.get("TEMP") or os.environ.get("TMP") or tempfile.gettempdir()
    return tempfile.gettempdir()


def default_output_path(project_path, family):
    project_name = safe_filename(os.path.basename(project_path))
    digest = hashlib.sha256(os.path.abspath(project_path).encode("utf-8")).hexdigest()[:10]
    return os.path.join(
        default_temp_dir(family),
        f"vibeguard_preflight_{project_name}_{digest}.json",
    )


def detect_language_support(project_path):
    ecosystems = []
    matched_files = []
    for ecosystem, names in LOCKFILE_MAP.items():
        for file_name in names:
            if os.path.isfile(os.path.join(project_path, file_name)):
                ecosystems.append(ecosystem)
                matched_files.append({"ecosystem": ecosystem, "file": file_name})
                break

    return {
        "supported": bool(matched_files),
        "ecosystems": ecosystems,
        "matched_files": matched_files,
    }


def parse_os_release(path):
    values = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                value = value.strip().strip('"').strip("'")
                values[key] = value
    except OSError:
        return {}
    return values


def normalize_platform(platform_override):
    if platform_override != "auto":
        return platform_override

    system = platform.system().lower()
    if system == "darwin":
        return "macos"
    if system == "linux":
        return "linux"
    if system == "windows":
        return "windows"
    return "unknown"


def detect_os(family, os_release_file=None):
    if family == "macos":
        version = platform.mac_ver()[0] or None
        return {
            "family": "macos",
            "name": "macOS",
            "version": version,
        }

    if family == "linux":
        release_path = os_release_file or "/etc/os-release"
        release = parse_os_release(release_path)
        distro_id = release.get("ID") or None
        distro_id_like = release.get("ID_LIKE") or None
        pretty_name = release.get("PRETTY_NAME") or release.get("NAME") or "Linux"
        return {
            "family": "linux",
            "name": pretty_name,
            "version": release.get("VERSION_ID") or None,
            "distro_id": distro_id,
            "distro_id_like": distro_id_like,
            "os_release_file": release_path if release else None,
        }

    if family == "windows":
        version_info = platform.win32_ver()
        version = version_info[1] or platform.version() or None
        return {
            "family": "windows",
            "name": "Windows",
            "version": version,
        }

    return {
        "family": family,
        "name": platform.system() or "unknown",
        "version": platform.version() or None,
    }


def detect_tool(spec, path_env=None):
    path = shutil.which(spec["command"], path=path_env)
    return {
        "name": spec["name"],
        "available": bool(path),
        "path": path,
        "update_check_command": spec["update_check_command"],
    }


def detect_tools(family, specs, path_env=None):
    return [detect_tool(spec, path_env=path_env) for spec in specs.get(family, [])]


def build_preflight(project_path, args):
    family = normalize_platform(args.platform)
    language_support = detect_language_support(project_path)
    output_file = args.output or default_output_path(project_path, family)
    recommended_scan_mode = (
        "full_dependency_scan" if language_support["supported"] else "hygiene_only"
    )

    return {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "project": {
            "path": project_path,
            "name": os.path.basename(project_path),
        },
        "language_support": language_support,
        "os": detect_os(family, os_release_file=args.os_release_file),
        "package_managers": detect_tools(
            family,
            PACKAGE_MANAGER_SPECS,
            path_env=args.path_env,
        ),
        "system_update_tools": detect_tools(
            family,
            SYSTEM_UPDATE_TOOL_SPECS,
            path_env=args.path_env,
        ),
        "recommended_scan_mode": recommended_scan_mode,
        "output_file": output_file,
    }


def main():
    args = parse_args(sys.argv[1:])
    project_path = (
        os.path.abspath(args.project_path)
        if args.no_root_discovery
        else find_project_root(args.project_path)
    )
    preflight = build_preflight(project_path, args)
    output = preflight["output_file"]
    os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)

    with open(output, "w", encoding="utf-8") as handle:
        json.dump(preflight, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    if args.compact:
        print(json.dumps(preflight, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(preflight, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
