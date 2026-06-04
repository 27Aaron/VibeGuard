#!/usr/bin/env python3
"""Run the complete VibeGuard local audit pipeline.

Usage:
    python3 scripts/run_audit.py [project_path]
    python3 scripts/run_audit.py --no-root-discovery [project_path]
    python3 scripts/run_audit.py --skip-outdated [project_path]

Pipeline:
  preflight -> scan -> analyze_scan -> render_markdown -> build_report
"""

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def script_path(name):
    return os.path.join(HERE, name)


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Run VibeGuard local audit pipeline")
    parser.add_argument("project_path", nargs="?", default=".")
    parser.add_argument(
        "--no-root-discovery",
        action="store_true",
        help="scan the provided path directly instead of walking up to a repo root",
    )
    parser.add_argument(
        "--skip-outdated",
        action="store_true",
        help="skip package-manager outdated checks for faster vulnerability-only scans",
    )
    parser.add_argument(
        "--skip-hygiene",
        action="store_true",
        help="skip gitignore, tracked sensitive file, and hardcoded secret checks",
    )
    parser.add_argument(
        "--api-concurrency",
        type=int,
        default=None,
        help="number of concurrent VibeGuard API package-check requests",
    )
    parser.add_argument(
        "--outdated-concurrency",
        type=int,
        default=None,
        help="number of concurrent outdated dependency checks",
    )
    parser.add_argument(
        "--max-secret-files",
        type=int,
        default=None,
        help="maximum number of candidate files to scan for hardcoded secrets",
    )
    parser.add_argument(
        "--include-packages",
        action="store_true",
        help="include the full package list in scan output JSON",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="print compact final JSON summary",
    )
    return parser.parse_args(argv)


def run_json(cmd):
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout, file=sys.stderr, end="")
        if result.stderr:
            print(result.stderr, file=sys.stderr, end="")
        raise SystemExit(result.returncode)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print(result.stdout, file=sys.stderr, end="")
        print(f"Failed to parse JSON from {' '.join(cmd)}: {exc}", file=sys.stderr)
        raise SystemExit(1)


def run_text(cmd, echo=True):
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        stdin=subprocess.DEVNULL,
    )
    if echo and result.stdout:
        print(result.stdout, end="")
    if echo and result.stderr:
        print(result.stderr, file=sys.stderr, end="")
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    return result.stdout


def build_scan_cmd(args, preflight_file):
    cmd = [
        sys.executable,
        script_path("scan.py"),
        "--preflight",
        preflight_file,
        "--compact",
    ]
    if args.skip_outdated:
        cmd.append("--skip-outdated")
    if args.skip_hygiene:
        cmd.append("--skip-hygiene")
    if args.include_packages:
        cmd.append("--include-packages")
    if args.api_concurrency is not None:
        cmd.extend(["--api-concurrency", str(args.api_concurrency)])
    if args.outdated_concurrency is not None:
        cmd.extend(["--outdated-concurrency", str(args.outdated_concurrency)])
    if args.max_secret_files is not None:
        cmd.extend(["--max-secret-files", str(args.max_secret_files)])
    return cmd


def main():
    args = parse_args(sys.argv[1:])

    preflight_cmd = [
        sys.executable,
        script_path("preflight.py"),
        "--compact",
    ]
    if args.no_root_discovery:
        preflight_cmd.append("--no-root-discovery")
    preflight_cmd.append(args.project_path)
    preflight = run_json(preflight_cmd)

    scan = run_json(build_scan_cmd(args, preflight["output_file"]))

    analysis_path = os.path.join(
        os.path.dirname(os.path.abspath(scan["output_file"])),
        "analysis.json",
    )
    run_text(
        [sys.executable, script_path("analyze_scan.py"), scan["output_file"], analysis_path],
        echo=not args.compact,
    )

    with open(analysis_path, "r", encoding="utf-8") as handle:
        analysis = json.load(handle)
    markdown_path = os.path.join(
        analysis["project"]["path"],
        "docs",
        f"security-report-{str(analysis.get('generated_at', 'unknown-date'))[:10]}.md",
    )
    run_text(
        [sys.executable, script_path("render_markdown.py"), analysis_path, markdown_path],
        echo=not args.compact,
    )

    html_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(analysis_path))),
        "content",
        "security-report.html",
    )
    run_text(
        [sys.executable, script_path("build_report.py"), analysis_path, html_path],
        echo=not args.compact,
    )

    summary = {
        "preflight_file": preflight["output_file"],
        "scan_file": scan["output_file"],
        "analysis_file": analysis_path,
        "markdown_report": markdown_path,
        "html_report": html_path,
        "scan_mode": scan.get("scan_config", {}).get("scan_mode"),
        "risk_summary": analysis.get("risk_summary", {}),
        "errors": analysis.get("errors", []),
    }

    if args.compact:
        print(json.dumps(summary, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
