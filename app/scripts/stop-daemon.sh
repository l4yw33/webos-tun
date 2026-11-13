#!/bin/sh
killall xraytun-daemon 2>/dev/null || true
sleep 1
pidof xraytun-daemon >/dev/null 2>&1 && { echo "daemon still running"; exit 1; }
echo "daemon stopped"
