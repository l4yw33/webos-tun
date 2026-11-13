# 1.3.0 update — 2026-11-13

- Fix the Chromium 38 black screen with file-origin-compatible CSP.
- Add default English and persistent English/Russian selection.
- Add manual HTTPS plain/Base64 subscription import and saved URL file loading.
- Strip URL fragments; verify TLS/public addresses and limit response size/time.
- Accept the exact legacy webOS app Origin; require authenticated API access.
- Protect runtime secrets and stop modifying boot hooks in the installer.
- Add HTTPS IPv4 fallback services and preserve check error messages.
- Add subscription/security/IP tests and update CI to compile all helper sources.
- Enforce LF shell-script line endings to avoid CR-suffixed runtime paths.

# 1.3.0-alpha

- Add VLESS TCP/gRPC/WS/XHTTP and REALITY parsing.
- Add native Hysteria2/Salamander through sing-box with endpoint bypass routing.
- Add selection from pasted share links and secret-redacted previews.
- Refuse profile changes in the UI while VPN processes or tun0 default route remain active.
- Refresh runtime scripts on app open after upgrades.
- Preserve bundled daemon API and binary. New TV protocols awaiting on-device validation.

# Changelog

## v1.2.3-alpha

Initial GitHub alpha release.

### Added

- webOS application for manual Xray/sing-box TUN control.
- Local app-started helper daemon on `127.0.0.1:17999`.
- Trojan share URL support for gRPC/TLS and WebSocket/TLS.
- Manual connect, disconnect, restart, refresh, check IP and emergency network reset actions.
- Clean runtime layout under `/home/root/webos-xray-tun`.
- Diagnostic script and log collection script.
- Documentation for installation, binaries, build, profiles, compatibility and troubleshooting.

### Tested

- LG OLED55C6V.
- webOS 3.4.0.
- Linux 3.16.7.
- armv7l.
- Trojan gRPC/TLS profile.

### Limitations

- Alpha release.
- Tested on one TV model.
- Only Trojan share URLs are supported.
- Xray-core and sing-box binaries are external runtime dependencies.
