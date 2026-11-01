#!/usr/bin/env bash
# ==============================================================================
# CricScore Release Notes Enrichment Tool
#
# Automatically guarantees that:
# 1. Release title is strictly the version tag (e.g. "v4.24.0").
# 2. Release notes are automatically enriched with full features, architecture
#    decisions, and platform updates from linked pull requests, replacing
#    semantic-release's 1-line commit message stub with enterprise release notes.
# ==============================================================================

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️ GitHub CLI (gh) not installed. Skipping release enrichment."
  exit 0
fi

python3 - << 'EOF'
import json
import os
import re
import subprocess
import sys

def run_cmd(cmd_list):
    try:
        res = subprocess.run(cmd_list, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except subprocess.CalledProcessError as e:
        return ""

def main():
    # 1. Get latest published release
    latest_tag = run_cmd(["gh", "release", "view", "--json", "tagName", "-q", ".tagName"])
    if not latest_tag:
        print("ℹ️ No releases found on GitHub. Skipping enrichment.")
        return

    print(f"🔍 Inspecting latest release: {latest_tag}")

    # 2. Enforce clean title (strictly version tag, e.g. "v4.24.0")
    run_cmd(["gh", "release", "edit", latest_tag, "--title", latest_tag])

    # 3. Fetch current release body
    current_body = run_cmd(["gh", "release", "view", latest_tag, "--json", "body", "-q", ".body"])

    # 4. Find linked PR numbers from release body or commit history
    pr_nums = re.findall(r'#([0-9]+)', current_body)
    commit_msg = run_cmd(["git", "log", "-1", latest_tag, "--pretty=%B"])
    pr_nums.extend(re.findall(r'#([0-9]+)', commit_msg))
    
    # Deduplicate while preserving order
    seen = set()
    unique_prs = [p for p in pr_nums if not (p in seen or seen.add(p))]

    for pr_num in unique_prs:
        print(f"🔗 Checking linked PR: #{pr_num}")
        pr_json = run_cmd(["gh", "pr", "view", pr_num, "--json", "number,title,body"])
        if not pr_json:
            continue
        try:
            pr_data = json.loads(pr_json)
        except Exception:
            continue

        pr_body = pr_data.get("body", "")
        if not pr_body:
            continue

        lines = pr_body.splitlines()
        capturing = False
        extracted_lines = []

        for line in lines:
            # Capture from Summary / Overview / Changes / Features
            if re.match(r'^##+\s*.*(Summary|Overview|Changes|Features|Purpose|Details)', line, re.IGNORECASE):
                capturing = True
                continue
            # Stop before test / checklist / validation sections
            elif re.match(r'^##+\s*.*(Validation|Verification|Testing|Checklist|Screenshots|Local Test)', line, re.IGNORECASE):
                capturing = False
                continue

            if capturing:
                # Omit checkboxes and test checklists
                if re.match(r'^\s*-\s*\[[ xX]\]', line):
                    continue
                extracted_lines.append(line)

        extracted_text = "\n".join(extracted_lines).strip()
        if extracted_text:
            new_notes = f"## {latest_tag}\n\n{extracted_text}\n\n---\nPull Request: #{pr_num}\n"
            print(f"✨ Enriching release {latest_tag} notes with PR #{pr_num} summary...")
            res = subprocess.run(["gh", "release", "edit", latest_tag, "--notes", new_notes], capture_output=True, text=True)
            if res.returncode == 0:
                print(f"✅ Release {latest_tag} successfully enriched!")
                return
            else:
                print(f"⚠️ Failed to edit release: {res.stderr}")

    print(f"ℹ️ Release {latest_tag} enrichment complete.")

if __name__ == "__main__":
    main()
EOF
