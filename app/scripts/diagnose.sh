#!/bin/sh
BASE="/home/root/webos-xray-tun"
APP="/media/developer/apps/usr/palm/applications/com.webosbrew.xraytun"

check_file() { [ -e "$1" ] && echo "yes" || echo "no"; }
check_exec() { [ -x "$1" ] && echo "yes" || echo "no"; }
cmd_exists() { command -v "$1" >/dev/null 2>&1 && echo "yes" || echo "no"; }

run_limited() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 8 "$@"
  else
    "$@"
  fi
}

print_file_head() {
  f="$1"
  if [ -r "$f" ]; then
    echo "--- $f"
    head -n 20 "$f" 2>/dev/null
  fi
}

printf 'webos-xray-tun diagnostics\n'
printf '=========================\n'
printf 'date: %s\n' "$(date 2>/dev/null)"
printf 'uname: %s\n' "$(uname -a 2>/dev/null)"
printf 'arch: %s\n' "$(uname -m 2>/dev/null)"
printf 'uid: %s\n' "$(id 2>/dev/null)"
printf 'app_dir: %s (%s)\n' "$APP" "$(check_file "$APP")"
printf 'runtime_dir: %s (%s)\n' "$BASE" "$(check_file "$BASE")"

printf '\n[webos version hints]\n'
print_file_head /etc/os-release
print_file_head /etc/webos-release
print_file_head /etc/version
print_file_head /etc/starfish-release

printf '\n[space]\n'
df -h /home /media /tmp 2>/dev/null || df -h 2>/dev/null

printf '\n[commands]\n'
for c in sh ip iptables wget pidof killall chmod mkdir cp sed awk grep head tail tar; do
  printf '%s: %s\n' "$c" "$(cmd_exists "$c")"
done

printf '\n[tun]\n'
printf '/dev/net/tun: %s\n' "$(check_file /dev/net/tun)"
[ -c /dev/net/tun ] && printf '/dev/net/tun_char_device: yes\n' || printf '/dev/net/tun_char_device: no\n'

printf '\n[runtime files]\n'
printf 'xray: %s\n' "$(check_exec "$BASE/bin/xray")"
printf 'sing-box: %s\n' "$(check_exec "$BASE/bin/sing-box")"
printf 'xraytun-daemon: %s\n' "$(check_exec "$BASE/bin/xraytun-daemon")"
printf 'default.url: %s\n' "$(check_file "$BASE/profiles/default.url")"
printf 'xray.json: %s\n' "$(check_file "$BASE/configs/xray.json")"
printf 'sing config: %s\n' "$(check_file "$BASE/configs/sing-tun-xray.json")"
printf 'scripts/status.sh: %s\n' "$(check_exec "$BASE/scripts/status.sh")"
printf 'scripts/vpn-on.sh: %s\n' "$(check_exec "$BASE/scripts/vpn-on.sh")"

printf '\n[versions]\n'
if [ -x "$BASE/bin/xray" ]; then
  run_limited "$BASE/bin/xray" version 2>&1 | head -n 4
else
  echo 'xray_version=missing'
fi
if [ -x "$BASE/bin/sing-box" ]; then
  run_limited "$BASE/bin/sing-box" version 2>&1 | head -n 10
else
  echo 'sing_box_version=missing'
fi
if [ -x "$BASE/bin/xraytun-daemon" ]; then
  file "$BASE/bin/xraytun-daemon" 2>/dev/null || true
fi

printf '\n[daemon]\n'
printf 'pid: %s\n' "$(pidof xraytun-daemon 2>/dev/null || true)"
wget -T 5 -Y off -O - http://127.0.0.1:17999/health 2>/dev/null || echo 'daemon_health=failed'
printf '\n'

printf '\n[vpn status]\n'
if [ -x "$BASE/scripts/status.sh" ]; then
  sh "$BASE/scripts/status.sh" 2>&1
else
  echo 'status.sh=missing'
fi

printf '\n[route]\n'
ip route 2>/dev/null || true
ip -6 route 2>/dev/null || true

printf '\n[processes]\n'
printf 'xray_pid: %s\n' "$(pidof xray 2>/dev/null || true)"
printf 'singbox_pid: %s\n' "$(pidof sing-box 2>/dev/null || true)"
printf 'daemon_pid: %s\n' "$(pidof xraytun-daemon 2>/dev/null || true)"

printf '\n[result]\n'
if [ "$(id -u 2>/dev/null)" != "0" ]; then
  echo 'RESULT: NOT_SUPPORTED: not running as root'
elif [ ! -e /dev/net/tun ]; then
  echo 'RESULT: NOT_SUPPORTED: missing /dev/net/tun'
elif [ ! -x "$BASE/bin/xraytun-daemon" ]; then
  echo 'RESULT: NOT_READY: missing helper daemon binary'
elif [ ! -x "$BASE/bin/xray" ]; then
  echo 'RESULT: NOT_READY: missing xray binary'
elif [ ! -x "$BASE/bin/sing-box" ]; then
  echo 'RESULT: NOT_READY: missing sing-box binary'
elif [ ! -f "$BASE/profiles/default.url" ]; then
  echo 'RESULT: NOT_READY: missing profiles/default.url'
elif [ ! -x "$BASE/scripts/status.sh" ]; then
  echo 'RESULT: NOT_READY: runtime scripts not installed'
else
  echo 'RESULT: READY_FOR_TEST'
fi
