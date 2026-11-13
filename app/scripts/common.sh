#!/bin/sh
umask 077
APP_ID="com.webosbrew.xraytun"
APP_DIR="/media/developer/apps/usr/palm/applications/$APP_ID"
BASE="/home/root/webos-xray-tun"
BIN="$BASE/bin"
CONFIG="$BASE/configs"
LOGS="$BASE/logs"
PROFILES="$BASE/profiles"
STATE="$BASE/state"
XRAY="$BIN/xray"
SING="$BIN/sing-box"
XRAY_CONFIG="$CONFIG/xray.json"
XRAY_RUN_CONFIG="$CONFIG/xray.run.json"
SING_CONFIG="$CONFIG/sing-tun-xray.json"
SING_NATIVE_CONFIG="$CONFIG/sing-native.run.json"
XRAY_LOG="$LOGS/xray.log"
SING_LOG="$LOGS/singbox.log"
APP_LOG="$LOGS/app.log"

mkdir -p "$BIN" "$CONFIG" "$LOGS" "$PROFILES" "$STATE" 2>/dev/null

log_msg() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$APP_LOG" 2>/dev/null
}

is_ipv4() {
  echo "$1" | awk -F. '
    NF==4 {
      for (i=1; i<=4; i++) {
        if ($i !~ /^[0-9]+$/ || $i < 0 || $i > 255) exit 1
      }
      exit 0
    }
    { exit 1 }
  '
}

is_usable_route_ip() {
  ip="$1"
  is_ipv4 "$ip" || return 1
  first="$(echo "$ip" | cut -d. -f1)"
  [ "$first" = "0" ] && return 1
  [ "$first" = "127" ] && return 1
  [ "$first" -ge 224 ] 2>/dev/null && return 1
  return 0
}

current_default_route() {
  ip route 2>/dev/null | awk '/^default /{print; exit}'
}

current_default_gateway() {
  ip route 2>/dev/null | awk '/^default /{for(i=1;i<=NF;i++){if($i=="via"){print $(i+1); exit}}}'
}

current_default_iface() {
  ip route 2>/dev/null | awk '/^default /{for(i=1;i<=NF;i++){if($i=="dev"){print $(i+1); exit}}}'
}

lan_iface() {
  ip route 2>/dev/null | awk '/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+ dev / && / proto kernel /{for(i=1;i<=NF;i++){if($i=="dev" && $(i+1)!="tun0"){print $(i+1); exit}}}'
}

lan_gateway_guess() {
  ip route 2>/dev/null | awk '/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+ dev / && / proto kernel /{split($1,a,"/"); split(a[1],o,"."); if(o[1]&&o[2]&&o[3]){print o[1]"."o[2]"."o[3]".1"; exit}}'
}

save_uplink() {
  route="$(current_default_route)"
  echo "$route" | grep -q ' dev tun0' && return 1
  gw="$(current_default_gateway)"
  iface="$(current_default_iface)"
  [ -n "$gw" ] && echo "$gw" > "$STATE/gateway"
  [ -n "$iface" ] && [ "$iface" != "tun0" ] && echo "$iface" > "$STATE/interface"
}

get_gateway() {
  [ -s "$STATE/gateway" ] && { cat "$STATE/gateway"; return 0; }
  gw="$(current_default_gateway)"; [ -n "$gw" ] && { echo "$gw"; return 0; }
  lan_gateway_guess
}

get_iface() {
  [ -s "$STATE/interface" ] && { cat "$STATE/interface"; return 0; }
  iface="$(current_default_iface)"; [ -n "$iface" ] && [ "$iface" != "tun0" ] && { echo "$iface"; return 0; }
  lan_iface
}

restore_default_route() {
  gw="$(get_gateway)"
  iface="$(get_iface)"
  [ -n "$gw" ] && [ -n "$iface" ] && [ "$iface" != "tun0" ] || return 1
  ip route replace default via "$gw" dev "$iface" 2>/dev/null
}

disable_ipv6() {
  echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null
  echo 1 > /proc/sys/net/ipv6/conf/default/disable_ipv6 2>/dev/null
  for dev in eth0 wlan0; do
    echo 1 > "/proc/sys/net/ipv6/conf/$dev/disable_ipv6" 2>/dev/null
    ip -6 addr flush dev "$dev" scope global 2>/dev/null
  done
  ip -6 route flush default 2>/dev/null
}

enable_ipv6() {
  echo 0 > /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null
  echo 0 > /proc/sys/net/ipv6/conf/default/disable_ipv6 2>/dev/null
  for dev in eth0 wlan0; do
    echo 0 > "/proc/sys/net/ipv6/conf/$dev/disable_ipv6" 2>/dev/null
  done
}

profile_server_host() {
  [ -s "$PROFILES/server_host" ] && { cat "$PROFILES/server_host" | tr -d '\r\n'; return 0; }
  sed -n 's/.*"server"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$PROFILES/profile.json" 2>/dev/null | head -n 1
}

# Robust for BusyBox/webOS nslookup. It must not return the local DNS server
# line such as "Address 1: 127.0.0.1 localhost.localdomain".
resolve_server_ip() {
  host="$1"
  if is_usable_route_ip "$host"; then echo "$host"; return 0; fi

  nslookup "$host" 2>/dev/null | awk '
    function ok(ip, n, a, i) {
      n=split(ip,a,".")
      if (n != 4) return 0
      for (i=1; i<=4; i++) {
        if (a[i] !~ /^[0-9]+$/ || a[i] < 0 || a[i] > 255) return 0
      }
      if (a[1] == 0 || a[1] == 127 || a[1] >= 224) return 0
      return 1
    }
    /^Name:/ { seen_name=1 }
    /^Address[[:space:]]+[0-9]+:/ {
      ip=$3
      if (seen_name && ok(ip)) { print ip; exit }
      if (ok(ip)) last=ip
    }
    /^Address:/ {
      ip=$2
      if (seen_name && ok(ip)) { print ip; exit }
      if (ok(ip)) last=ip
    }
    END { if (last) print last }
  ' | head -n 1 && return 0

  getent hosts "$host" 2>/dev/null | awk '{print $1}' | while read ip; do
    is_usable_route_ip "$ip" && { echo "$ip"; break; }
  done | head -n 1 && return 0

  ping -c 1 -W 3 "$host" 2>/dev/null | sed -n 's/^PING[^(]*(\([0-9.][0-9.]*\)).*/\1/p' | while read ip; do
    is_usable_route_ip "$ip" && { echo "$ip"; break; }
  done | head -n 1
}

apply_server_route() {
  ipaddr="$1"
  gw="$2"
  iface="$3"
  [ -n "$ipaddr" ] && [ -n "$gw" ] && [ -n "$iface" ] && [ "$iface" != "tun0" ] || return 1
  is_usable_route_ip "$ipaddr" || return 1
  ip route replace "$ipaddr"/32 via "$gw" dev "$iface" 2>/dev/null || return 1
  ip route get "$ipaddr" 2>/dev/null | grep -q "dev $iface"
}

start_vpn_process() {
  log_file="$1"
  shift
  mkdir -p "$(dirname "$log_file")" 2>/dev/null || true
  (
    cd / || exit 0
    ulimit -n 4096 2>/dev/null || true
    if command -v nice >/dev/null 2>&1; then
      nohup nice -n 10 "$@" > "$log_file" 2>&1 < /dev/null &
    else
      nohup "$@" > "$log_file" 2>&1 < /dev/null &
    fi
  )
}

build_xray_run_config() {
  ipaddr="$1"
  [ -f "$XRAY_CONFIG" ] || return 1
  if is_usable_route_ip "$ipaddr"; then
    awk -v ip="$ipaddr" '
      BEGIN { done=0 }
      {
        if ($0 ~ /"loglevel"[[:space:]]*:/) {
          sub(/"loglevel"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"loglevel\": \"warning\"")
        }
        if (!done && $0 ~ /"address"[[:space:]]*:/) {
          sub(/"address"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"address\": \"" ip "\"")
          done=1
        }
        print
      }
    ' "$XRAY_CONFIG" > "$XRAY_RUN_CONFIG"
  else
    awk '{
      if ($0 ~ /"loglevel"[[:space:]]*:/) {
        sub(/"loglevel"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"loglevel\": \"warning\"")
      }
      print
    }' "$XRAY_CONFIG" > "$XRAY_RUN_CONFIG"
  fi
}

json_escape() {
  echo "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

# profile.json and configs/xray.json are saved together by the existing daemon API.
# For native Hysteria2, the legacy xray config slot holds a sing-box config.
profile_engine() {
  if grep -q '"protocol"[[:space:]]*:[[:space:]]*"hysteria2"' "$PROFILES/profile.json" 2>/dev/null; then
    echo sing-box
  else
    echo xray
  fi
}

build_sing_native_config() {
  ipaddr="$1"
  is_usable_route_ip "$ipaddr" || return 1
  [ -f "$XRAY_CONFIG" ] || return 1
  awk -v ip="$ipaddr" '
    BEGIN { done=0 }
    { if (!done && $0 ~ /"server"[[:space:]]*:/) {
        sub(/"server"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"server\": \"" ip "\"")
        done=1
      }
      print
    }
    END { if (!done) exit 1 }
  ' "$XRAY_CONFIG" > "$SING_NATIVE_CONFIG"
}
