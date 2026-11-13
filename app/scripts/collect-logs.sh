#!/bin/sh
umask 077
BASE="/home/root/webos-xray-tun"
OUT="$(mktemp -d /tmp/webos-tun-diagnostics.XXXXXX)" || exit 1
ARCHIVE="$OUT/diagnostics.tar.gz"

{
  echo 'webos-xray-tun diagnostics'
  echo '========================='
  printf 'kernel: '; uname -s 2>/dev/null
  printf 'architecture: '; uname -m 2>/dev/null
  # Do not export hostname, user/group IDs, mounts, IP/MAC addresses or routes.
  # Counts are enough to flag missing defaults without publishing identifiers.
  printf 'IPv4 default routes: '; ip route 2>/dev/null | awk '/^default / {n++} END {print n+0}'
  printf 'IPv6 default routes: '; ip -6 route 2>/dev/null | awk '/^default / {n++} END {print n+0}'
} > "$OUT/system.txt" 2>&1

# Status output includes real routes and server details. Keep it local to the UI.
printf '{"note":"Detailed status omitted for privacy"}\n' > "$OUT/status.json"

# Profiles, configs and raw core logs are deliberately excluded.
cat > "$OUT/README.txt" <<'TXT'
Review all files before publishing. Do not upload real profile URLs, passwords, UUIDs or private server details.
Hostnames, account IDs, disk layouts and network routes are not collected.
Profiles, subscription URLs, configs and raw core logs are not included.
TXT

if command -v tar >/dev/null 2>&1; then
  tar -czf "$ARCHIVE" -C "$OUT" system.txt status.json README.txt 2>/dev/null && echo "$ARCHIVE" && exit 0
fi

echo "$OUT"
