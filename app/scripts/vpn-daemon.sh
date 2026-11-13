#!/bin/sh
BASE="/home/root/webos-xray-tun"
LOGS="$BASE/logs"
LOG="$LOGS/vpn-daemon.log"
mkdir -p "$LOGS"
echo "===== vpn-daemon start $(date) =====" >> "$LOG"
if [ -f "$BASE/DISABLE_AUTO" ]; then
  echo "[daemon] disabled by DISABLE_AUTO" >> "$LOG"
  exit 0
fi
"$BASE/scripts/vpn-off.sh" >> "$LOG" 2>&1
sleep 2
"$BASE/scripts/vpn-on.sh" >> "$LOG" 2>&1
