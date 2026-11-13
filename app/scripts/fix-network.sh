#!/bin/sh
BASE="/home/root/webos-xray-tun"
. "$BASE/scripts/common.sh" 2>/dev/null || . /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/common.sh

echo "[fix-network] emergency cleanup"
killall sing-box 2>/dev/null
killall xray 2>/dev/null
sleep 1
ip route del default dev tun0 2>/dev/null || true
ip link del tun0 2>/dev/null || true

if restore_default_route; then
  echo "[fix-network] default route restored"
else
  echo "[fix-network] warning: cannot restore default route automatically"
fi

if [ -s "$STATE/server_ip" ]; then
  ip route del "$(cat "$STATE/server_ip")"/32 2>/dev/null || true
  rm -f "$STATE/server_ip"
fi

enable_ipv6
log_msg "fix-network"
echo "[fix-network] route:"
ip route 2>/dev/null
echo "[fix-network] done"
