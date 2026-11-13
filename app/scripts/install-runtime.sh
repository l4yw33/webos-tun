#!/bin/sh
APP_DIR="/media/developer/apps/usr/palm/applications/com.webosbrew.xraytun"
BASE="/home/root/webos-xray-tun"
umask 077

mkdir -p "$BASE/scripts" "$BASE/configs" "$BASE/bin" "$BASE/logs" "$BASE/profiles" "$BASE/state"
chmod 700 "$BASE" "$BASE/bin" "$BASE/scripts" "$BASE/configs" "$BASE/profiles" "$BASE/logs" "$BASE/state" || exit 1
find "$BASE/configs" "$BASE/profiles" "$BASE/logs" "$BASE/state" -type f -exec chmod 600 {} \;

# Do not create, remove or modify boot hooks.

# Copy app-controlled lightweight runtime files. Do not overwrite user profile or user xray/sing-box binaries.
cp -f "$APP_DIR"/scripts/*.sh "$BASE/scripts/" 2>/dev/null || true
cp -f "$APP_DIR"/configs/sing-tun-xray.json "$BASE/configs/sing-tun-xray.json" 2>/dev/null || true
if [ ! -f "$BASE/configs/xray.json" ] && [ -f "$APP_DIR/configs/xray.example.json" ]; then
  cp -f "$APP_DIR/configs/xray.example.json" "$BASE/configs/xray.json" 2>/dev/null || true
fi
chmod +x "$BASE"/scripts/*.sh 2>/dev/null || true

# Migration helper only: reuse old manual binaries via symlink, never copy huge xray/sing-box files.
if [ ! -e "$BASE/bin/xray" ] && [ -x /home/root/vpn/xray ]; then
  ln -s /home/root/vpn/xray "$BASE/bin/xray" 2>/dev/null || true
fi
if [ ! -e "$BASE/bin/sing-box" ] && [ -x /home/root/vpn/sing-box ]; then
  ln -s /home/root/vpn/sing-box "$BASE/bin/sing-box" 2>/dev/null || true
fi

# Daemon binary is app-owned runtime helper. It is started when the app opens, not on TV boot.
[ -f "$APP_DIR/bin/xraytun-daemon" ] || { echo "daemon must be built first"; exit 1; }
if ! cmp -s "$APP_DIR/bin/xraytun-daemon" "$BASE/bin/xraytun-daemon"; then
  killall xraytun-daemon 2>/dev/null || true
  cp "$APP_DIR/bin/xraytun-daemon" "$BASE/bin/xraytun-daemon.new" || exit 1
  chmod 700 "$BASE/bin/xraytun-daemon.new" || exit 1
  mv -f "$BASE/bin/xraytun-daemon.new" "$BASE/bin/xraytun-daemon" || exit 1
fi

chmod +x "$BASE/bin/xray" "$BASE/bin/sing-box" "$BASE/bin/xraytun-daemon" 2>/dev/null || true

cat > "$BASE/README_RUNTIME.txt" <<'RTEOF'
This directory is runtime data for webos-xray-tun.
The app starts xraytun-daemon on demand when opened.
The daemon is not started on TV boot and VPN is never auto-connected.
User files:
  bin/xray
  bin/sing-box
  profiles/default.url
RTEOF

echo "runtime=$BASE"
echo "daemon_start=app_open_only"
exit 0
