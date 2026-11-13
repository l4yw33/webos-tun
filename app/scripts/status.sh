#!/bin/sh
BASE="/home/root/webos-xray-tun"
. "$BASE/scripts/common.sh" 2>/dev/null || . /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/common.sh

xpid="$(pidof xray 2>/dev/null)"
spid="$(pidof sing-box 2>/dev/null)"
route="$(current_default_route | sed 's/"//g')"
server_ip=""
server_route=""
if [ -s "$STATE/server_ip" ]; then
  server_ip="$(cat "$STATE/server_ip" 2>/dev/null)"
  server_route="$(ip route 2>/dev/null | grep "^$server_ip/32\|^$server_ip " | head -n 1 | sed 's/"//g')"
fi

engine="$(cat "$STATE/engine" 2>/dev/null)"
[ -n "$engine" ] || engine="$(profile_engine)"
vpn="OFF"
echo "$route" | grep -q ' dev tun0' && vpn="STALE"
if echo "$route" | grep -q ' dev tun0' && [ -n "$spid" ] && { [ "$engine" = "sing-box" ] || [ -n "$xpid" ]; }; then vpn="ON"; fi
if [ "$vpn" = "ON" ] && [ -n "$server_ip" ] && ! echo "$server_route" | grep -q ' dev '; then vpn="BROKEN_ROUTE"; fi

ipv6="enabled"
[ "$(cat /proc/sys/net/ipv6/conf/eth0/disable_ipv6 2>/dev/null)" = "1" ] && ipv6="disabled"
ip -6 route 2>/dev/null | grep -q '^default ' && ipv6="$ipv6, route-present"

runtime="ok"
runtime_detail="ready"
[ "$engine" != "xray" ] || [ -x "$XRAY" ] || { runtime="setup needed"; runtime_detail="missing xray binary"; }
if [ "$runtime" = "ok" ] && [ ! -x "$SING" ]; then runtime="setup needed"; runtime_detail="missing sing-box binary"; fi
if [ "$runtime" = "ok" ] && [ ! -f "$PROFILES/default.url" ]; then runtime="setup needed"; runtime_detail="missing profile file"; fi
if [ "$runtime" = "ok" ] && [ ! -f "$PROFILES/profile.json" ]; then runtime="setup needed"; runtime_detail="profile not saved"; fi
if [ "$runtime" = "ok" ] && [ ! -f "$XRAY_CONFIG" ]; then runtime="setup needed"; runtime_detail="xray config missing"; fi
if [ "$runtime" = "ok" ] && [ ! -f "$SING_CONFIG" ]; then runtime="failed"; runtime_detail="sing-box config missing"; fi

printf '{\n'
printf '  "engine": "%s",\n' "$engine"
printf '  "vpn": "%s",\n' "$(json_escape "$vpn")"
printf '  "xray_pid": "%s",\n' "$(json_escape "$xpid")"
printf '  "singbox_pid": "%s",\n' "$(json_escape "$spid")"
printf '  "route": "%s",\n' "$(json_escape "$route")"
printf '  "server_route": "%s",\n' "$(json_escape "$server_route")"
printf '  "ipv6": "%s",\n' "$(json_escape "$ipv6")"
printf '  "runtime": "%s",\n' "$(json_escape "$runtime")"
printf '  "runtime_detail": "%s"\n' "$(json_escape "$runtime_detail")"
printf '}\n'
