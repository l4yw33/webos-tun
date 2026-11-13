#!/bin/sh
BASE="/home/root/webos-xray-tun"
. "$BASE/scripts/common.sh" 2>/dev/null || . /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/common.sh

echo "[vpn-off] restore default route"
restore_default_route >/dev/null 2>&1 || true

echo "[vpn-off] stop processes"
killall sing-box 2>/dev/null
killall xray 2>/dev/null

echo "[vpn-off] cleanup tun and server route"
ip route del default dev tun0 2>/dev/null || true
ip link del tun0 2>/dev/null || true
if [ -s "$STATE/server_ip" ]; then
  ip route del "$(cat "$STATE/server_ip")"/32 2>/dev/null || true
  rm -f "$STATE/server_ip"
fi

echo "[vpn-off] restore IPv6"
rm -f "$STATE/engine"
enable_ipv6
log_msg "vpn off"
echo "[vpn-off] route:"
ip route 2>/dev/null
