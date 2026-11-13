#!/bin/sh
BASE="/home/root/webos-xray-tun"
. "$BASE/scripts/common.sh" 2>/dev/null || . /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/common.sh

cd "$BASE" || exit 1

fail() {
  code="$1"; shift
  echo "ERROR: $*"
  rm -f "$STATE/engine"
  echo "[vpn-on] rollback network"
  killall sing-box 2>/dev/null
  killall xray 2>/dev/null
  ip route del default dev tun0 2>/dev/null || true
  ip link del tun0 2>/dev/null || true
  restore_default_route >/dev/null 2>&1 || true
  enable_ipv6 >/dev/null 2>&1 || true
  echo "[vpn-on] route after rollback:"
  ip route 2>/dev/null
  exit "$code"
}

engine="$(profile_engine)"
echo "[vpn-on] preflight engine=$engine"
if [ "$engine" = "xray" ]; then
  [ -x "$XRAY" ] || fail 1 "missing xray binary: $XRAY"
  "$XRAY" version >/dev/null 2>&1 || fail 1 "xray binary does not run"
fi
[ -x "$SING" ] || fail 1 "missing sing-box binary: $SING"
"$SING" version >/dev/null 2>&1 || fail 1 "sing-box binary does not run"
[ -f "$XRAY_CONFIG" ] || fail 1 "missing xray config. Load profile file and Save profile first."
[ -f "$SING_CONFIG" ] || fail 1 "missing sing-box config: $SING_CONFIG"

# If a previous failed run left default dev tun0, restore LAN route first.
if current_default_route | grep -q ' dev tun0'; then
  echo "[vpn-on] stale tun0 default found, restoring uplink first"
  restore_default_route >/dev/null 2>&1 || true
fi
save_uplink >/dev/null 2>&1 || true
gw="$(get_gateway)"
iface="$(get_iface)"
[ -n "$gw" ] && [ -n "$iface" ] && [ "$iface" != "tun0" ] || { ip route; fail 1 "cannot detect real gateway/interface"; }

server_host="$(profile_server_host)"
[ -n "$server_host" ] || fail 1 "profile server is empty. Load profile file and Save profile first."

echo "[vpn-on] resolve server: $server_host"
server_ip="$(resolve_server_ip "$server_host" | head -n 1)"
if ! is_usable_route_ip "$server_ip"; then
  echo "[vpn-on] nslookup output:"
  nslookup "$server_host" 2>&1 || true
  fail 1 "cannot resolve usable server IPv4 before VPN route: $server_host resolved='$server_ip'"
fi

echo "[vpn-on] cleanup old state"
rm -f "$STATE/engine"
killall sing-box 2>/dev/null
killall xray 2>/dev/null
ip route del default dev tun0 2>/dev/null || true
ip link del tun0 2>/dev/null || true
if [ -s "$STATE/server_ip" ]; then
  old_ip="$(cat "$STATE/server_ip" 2>/dev/null)"
  [ -n "$old_ip" ] && ip route del "$old_ip"/32 2>/dev/null || true
fi
restore_default_route >/dev/null 2>&1 || true

# Critical route: Xray's own transport must not enter tun0.
echo "[vpn-on] server bypass route: $server_ip via $gw dev $iface"
apply_server_route "$server_ip" "$gw" "$iface" || { ip route; fail 1 "cannot apply server bypass route for $server_ip via $gw dev $iface"; }
echo "$server_ip" > "$STATE/server_ip"
echo "$server_host" > "$STATE/server_host"
echo "$server_ip" > "$PROFILES/server_ip"

if [ "$engine" = "sing-box" ]; then
  echo "[vpn-on] build native Hysteria2 runtime config"
  build_sing_native_config "$server_ip" || fail 1 "cannot build sing-box runtime config"
  SING_CONFIG="$SING_NATIVE_CONFIG"
else
  echo "[vpn-on] build xray runtime config"
  build_xray_run_config "$server_ip" || fail 1 "cannot build xray runtime config"
  "$XRAY" run -test -config "$XRAY_RUN_CONFIG" >"$LOGS/xray-check.log" 2>&1 || {
    echo "Xray config rejected; inspect runtime version and supported transport"; fail 1 "xray config check failed"
  }
fi
"$SING" check -c "$SING_CONFIG" >"$LOGS/sing-check.log" 2>&1 || {
  echo "sing-box config rejected; verify Hysteria2/QUIC and gVisor build support"; fail 1 "sing-box config check failed"
}

echo "[vpn-on] disable IPv6 while VPN is active"
disable_ipv6
: > "$XRAY_LOG"
: > "$SING_LOG"

if [ "$engine" = "xray" ]; then
  echo "[vpn-on] start xray"
  start_vpn_process "$XRAY_LOG" "$XRAY" run -config "$XRAY_RUN_CONFIG"
  sleep 2
  pidof xray >/dev/null 2>&1 || fail 1 "xray not running; see xray log"
  renice 10 $(pidof xray) >/dev/null 2>&1 || true
fi

echo "[vpn-on] start sing-box"
start_vpn_process "$SING_LOG" "$SING" run -c "$SING_CONFIG"
sleep 3
pidof sing-box >/dev/null 2>&1 || { tail -n 80 "$SING_LOG"; fail 1 "sing-box not running"; }
renice 10 $(pidof sing-box) >/dev/null 2>&1 || true
ip addr show tun0 >/dev/null 2>&1 || { tail -n 80 "$SING_LOG"; fail 1 "tun0 not found"; }

echo "[vpn-on] apply VPN default route"
ip route replace default dev tun0 || fail 1 "cannot apply default dev tun0"
apply_server_route "$server_ip" "$gw" "$iface" || { ip route; fail 1 "server bypass route lost after tun0 default"; }

echo "$engine" > "$STATE/engine"
log_msg "vpn on server_host=$server_host server_ip=$server_ip gw=$gw iface=$iface"
echo "[vpn-on] route:"
ip route
echo "[vpn-on] done"
