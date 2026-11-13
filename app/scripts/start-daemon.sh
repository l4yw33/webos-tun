#!/bin/sh
BASE="/home/root/webos-xray-tun"
APP_DIR="/media/developer/apps/usr/palm/applications/com.webosbrew.xraytun"
mkdir -p "$BASE/bin" "$BASE/logs" "$BASE/state" "$BASE/scripts" "$BASE/configs" "$BASE/profiles" 2>/dev/null

# Ensure runtime files exist first.
if [ -x "$APP_DIR/scripts/install-runtime.sh" ]; then
  sh "$APP_DIR/scripts/install-runtime.sh" >/dev/null 2>&1 || true
fi

if pidof xraytun-daemon >/dev/null 2>&1; then
  echo "daemon already running: $(pidof xraytun-daemon)"
  exit 0
fi

[ -x "$BASE/bin/xraytun-daemon" ] || { echo "missing daemon binary: $BASE/bin/xraytun-daemon"; exit 1; }

: > "$BASE/logs/daemon.log"
(
  cd / || exit 0
  nohup "$BASE/bin/xraytun-daemon" >> "$BASE/logs/daemon.log" 2>&1 < /dev/null &
)
sleep 1
if pidof xraytun-daemon >/dev/null 2>&1; then
  echo "daemon started: $(pidof xraytun-daemon)"
  exit 0
fi

echo "daemon failed"
tail -n 80 "$BASE/logs/daemon.log" 2>/dev/null
exit 1
