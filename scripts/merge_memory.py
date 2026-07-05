#!/usr/bin/env python3
"""Merge a worktree session's memory dir into the canonical project memory dir.

Invoked by scripts/sessions/end-session.sh. See docs/development.md §3 for
the policy.

Usage:
    merge_memory.py [--dry-run] <session_mem_dir> <canonical_mem_dir>

Rules:
    1. Files only in the session dir are copied to the canonical dir.
    2. Files in both with identical contents are skipped.
    3. Files in both with different contents are surfaced as conflicts.
       The operator picks: keep main, keep session, or keep both
       (session saved under <name>.session.md for human review).
    4. MEMORY.md is handled specially: new index lines from the session
       are appended to the canonical MEMORY.md, de-duplicated by slug.
    5. Nothing is deleted from the canonical dir.
"""

import re
import shutil
import sys
from pathlib import Path


def parse_memory_index_slugs(index_path: Path) -> set[str]:
    """Return the set of file slugs referenced from a MEMORY.md index."""
    if not index_path.exists():
        return set()
    slugs: set[str] = set()
    link_re = re.compile(r"\(([^)]+\.md)\)")
    for line in index_path.read_text().splitlines():
        stripped = line.strip()
        if not stripped.startswith("- ["):
            continue
        match = link_re.search(stripped)
        if match:
            slugs.add(match.group(1).strip())
    return slugs


def memory_index_lines(index_path: Path) -> list[str]:
    """Return non-empty index lines in a MEMORY.md (the `- [Title](file.md) note` ones)."""
    if not index_path.exists():
        return []
    return [
        line
        for line in index_path.read_text().splitlines()
        if line.strip().startswith("- [")
    ]


def prompt_choice(prompt: str, choices: list[str], dry_run: bool) -> str:
    if dry_run:
        return "main"
    while True:
        answer = input(prompt).strip().lower()
        if answer in choices:
            return answer
        print(f"  Please enter one of: {', '.join(choices)}")


def merge(session_dir: Path, canonical_dir: Path, dry_run: bool) -> None:
    if not session_dir.exists():
        print(f"Session memory dir {session_dir} does not exist; nothing to merge.")
        return

    canonical_dir.mkdir(parents=True, exist_ok=True)

    session_files = {p.name for p in session_dir.iterdir() if p.is_file()}
    canonical_files = {p.name for p in canonical_dir.iterdir() if p.is_file()}

    new_files = session_files - canonical_files
    common_files = (session_files & canonical_files) - {"MEMORY.md"}

    # New memory files from the session.
    for name in sorted(new_files):
        if name == "MEMORY.md":
            continue
        src = session_dir / name
        dst = canonical_dir / name
        if dry_run:
            print(f"  [dry-run] would copy new file: {name}")
        else:
            shutil.copy2(src, dst)
            print(f"  copied new file: {name}")

    # Files in both: compare and resolve.
    for name in sorted(common_files):
        src = session_dir / name
        dst = canonical_dir / name
        if src.read_bytes() == dst.read_bytes():
            continue
        print()
        print(f"  Conflict on {name}:")
        print(f"    canonical: {dst}")
        print(f"    session:   {src}")
        choice = prompt_choice(
            "    Keep [m]ain / [s]ession / [k]eep both (session saved as <name>.session.md): ",
            ["m", "s", "k"],
            dry_run,
        )
        if dry_run:
            print("    [dry-run] no action taken.")
            continue
        if choice == "s":
            shutil.copy2(src, dst)
            print("    used session version.")
        elif choice == "k":
            alt = canonical_dir / f"{src.stem}.session.md"
            shutil.copy2(src, alt)
            print(f"    saved session version as {alt.name}; canonical left alone.")
        else:
            print("    kept canonical version.")

    # MEMORY.md: append new index lines from the session, de-duplicated.
    session_index = session_dir / "MEMORY.md"
    canonical_index = canonical_dir / "MEMORY.md"
    if session_index.exists():
        if not canonical_index.exists():
            if dry_run:
                print(f"  [dry-run] would copy MEMORY.md (canonical has none).")
            else:
                shutil.copy2(session_index, canonical_index)
                print("  copied MEMORY.md (canonical had none).")
        else:
            canonical_slugs = parse_memory_index_slugs(canonical_index)
            new_lines: list[str] = []
            link_re = re.compile(r"\(([^)]+\.md)\)")
            for line in memory_index_lines(session_index):
                match = link_re.search(line)
                slug = match.group(1).strip() if match else None
                if slug and slug in canonical_slugs:
                    continue
                new_lines.append(line)
            if new_lines:
                if dry_run:
                    print(f"  [dry-run] would append {len(new_lines)} line(s) to MEMORY.md:")
                    for line in new_lines:
                        print(f"      {line}")
                else:
                    with canonical_index.open("a") as f:
                        f.write("\n")
                        for line in new_lines:
                            f.write(line + "\n")
                    print(f"  appended {len(new_lines)} line(s) to MEMORY.md.")

    print()
    print("Memory merge complete." if not dry_run else "Dry-run finished. No changes written.")


def main() -> None:
    args = sys.argv[1:]
    dry_run = False
    if args and args[0] == "--dry-run":
        dry_run = True
        args = args[1:]
    if len(args) != 2:
        print("Usage: merge_memory.py [--dry-run] <session_mem_dir> <canonical_mem_dir>", file=sys.stderr)
        sys.exit(1)
    merge(Path(args[0]), Path(args[1]), dry_run)


if __name__ == "__main__":
    main()
