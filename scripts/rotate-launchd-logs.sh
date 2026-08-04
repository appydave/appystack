#!/bin/bash
# rotate-launchd-logs.sh — bound the size of every launchd-redirected log on this Mac.
#
# WHY THIS EXISTS
#   launchd's StandardOutPath/StandardErrorPath append to a file forever. Nothing
#   in macOS rotates them for a user LaunchAgent. On 2026-08-04 two AppyDave
#   daemons had quietly written 181 MB and 48 MB with no upper bound —
#   ~21 MB/day, ~7.6 GB/year, entirely unnoticed.
#
#   The primary fix is at the source (don't log per-request chatter at info —
#   see appystack template/server/src/middleware/requestLogger.ts). This script
#   is the BACKSTOP for anything that slips through, and it is deliberately
#   generic so a future app is covered the day it ships, with no new config.
#
# HOW IT ROTATES (this matters)
#   A running daemon holds an open file descriptor to its log. `mv` would leave
#   it writing to the moved inode — the "rotated" file keeps growing and the new
#   one stays empty. So we COPY then TRUNCATE IN PLACE (`: > file`), which keeps
#   the descriptor valid. Never change this to mv/rm without restarting daemons.
#
# USAGE
#   rotate-launchd-logs.sh              # rotate anything over the threshold
#   rotate-launchd-logs.sh --dry-run    # report only, change nothing
#   MAX_MB=20 rotate-launchd-logs.sh    # override threshold (default 25 MB)

set -uo pipefail

MAX_MB="${MAX_MB:-25}"
KEEP="${KEEP:-1}"          # how many .1/.2 generations to retain
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

MAX_BYTES=$(( MAX_MB * 1024 * 1024 ))
freed_total=0

free_kb() { df -k /System/Volumes/Data | awk 'NR==2{print $4}'; }

echo "rotate-launchd-logs :: threshold ${MAX_MB} MB, keep ${KEEP}$([ $DRY_RUN -eq 1 ] && echo ' [DRY RUN]')"

# Collect every log path declared by a LaunchAgent plist, de-duplicated.
# Some plists point stdout and stderr at the SAME file — rotating twice would
# discard the first copy, so uniq is load-bearing, not tidiness.
log_paths=$(
  for plist in "$HOME"/Library/LaunchAgents/*.plist; do
    [ -f "$plist" ] || continue
    for key in StandardOutPath StandardErrorPath; do
      plutil -extract "$key" raw "$plist" 2>/dev/null
    done
  done | sort -u
)

[ -z "$log_paths" ] && { echo "  no LaunchAgent log paths found"; exit 0; }

while IFS= read -r log; do
  [ -n "$log" ] && [ -f "$log" ] || continue
  size=$(stat -f '%z' "$log" 2>/dev/null) || continue
  [ "$size" -le "$MAX_BYTES" ] && continue

  mb=$(( size / 1024 / 1024 ))
  if [ $DRY_RUN -eq 1 ]; then
    printf "  WOULD ROTATE  %5s MB  %s\n" "$mb" "$log"
    continue
  fi

  before=$(free_kb)

  # Age existing generations: .1 -> .2, etc. Oldest falls off the end.
  i="$KEEP"
  while [ "$i" -gt 1 ]; do
    [ -f "${log}.$(( i - 1 ))" ] && mv -f "${log}.$(( i - 1 ))" "${log}.${i}"
    i=$(( i - 1 ))
  done
  # -c = APFS clone: instant regardless of size, no second copy of the bytes
  # while both files exist. Falls back to a normal copy on non-APFS.
  [ "$KEEP" -ge 1 ] && { cp -c "$log" "${log}.1" 2>/dev/null || cp -f "$log" "${log}.1"; }

  # Truncate in place — preserves the running daemon's open fd. See header.
  : > "$log"

  after=$(free_kb)
  freed=$(( (after - before) / 1024 ))
  freed_total=$(( freed_total + freed ))
  printf "  rotated  %5s MB -> 0   freed %s MB   %s\n" "$mb" "$freed" "$log"
done <<< "$log_paths"

if [ $DRY_RUN -eq 0 ]; then
  # Expect ~0 with KEEP>=1: rotation CAPS growth at (KEEP+1) x threshold, it does
  # not free space on the first pass — the retained generation still holds the
  # bytes. Space is returned when that generation is later aged out. Set KEEP=0
  # to discard instead of retain.
  echo "rotate-launchd-logs :: real freed this pass (df delta): ${freed_total} MB"
  echo "  note: with KEEP=${KEEP}, growth is now capped at ~$(( MAX_MB * (KEEP + 1) )) MB per log."
fi
