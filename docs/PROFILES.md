# Profiles (1.3.0)

Import a share link in Connection URLs, or use the separate HTTPS subscription field.
For plain/Base64 subscription lists, press Update subscription, select a server and Save profile.
An uploaded `profiles/subscription.url` is read on startup or with Load subscription file.
Paste links into the app, one per line, or load `/home/root/webos-xray-tun/profiles/default.url`.
Choose a connection from the selector, disconnect any active VPN, press Save profile, then Connect.
Only the selected link is persisted. The temporary multi-link list is lost when the app closes.

Supported:
- Trojan: TCP, gRPC, WebSocket, XHTTP, TLS.
- VLESS: UUID, TCP/gRPC/WebSocket/XHTTP, TLS/REALITY. Vision only with TCP.
- Hysteria2 (`hysteria2://` or `hy2://`), optional Salamander.

Examples below contain placeholders, not working credentials:

```text
hysteria2://PASSWORD@vpn.example:443/?sni=vpn.example&obfs=salamander&obfs-password=OBFS_PASSWORD#Main
vless://11111111-2222-4333-8444-555555555555@vpn.example:443?encryption=none&security=tls&type=xhttp&sni=vpn.example&host=vpn.example&path=%2FREPLACE&mode=auto&fp=firefox&alpn=h2#Backup
trojan://PASSWORD@vpn.example:443?security=tls&type=grpc&serviceName=%2Fservice&authority=vpn.example#Legacy
```

Keep SNI, XHTTP path/host/mode, authentication and Salamander password exactly as exported by the server. A server IP alone is insufficient. The bypass IPv4 is resolved before enabling the TUN; the TLS server name is retained when the runtime substitutes the IP.

TLS verification defaults to enabled. Links disabling certificate validation are rejected. The preview masks authentication and obfuscation passwords and VLESS IDs. The textarea still contains the actual link.

Hysteria2 uses native sing-box with QUIC support and gVisor TUN support. Xray is not needed for that profile. `upmbps` / `downmbps`, when supplied, are imported; otherwise bandwidth fields are omitted. No server settings or congestion-control overrides are changed.

VLESS XHTTP needs an Xray binary supporting XHTTP. Native Hysteria2 config targets the sing-box 1.11–1.13 configuration family; runtime validation is always run on TV before the VPN default route is installed. Merely accepting a link does not establish a connection.

Unsupported options are rejected for IPv6 endpoints, port hopping, ECH, certificate pinning and separate XHTTP download endpoints. VMess, Shadowsocks, QR codes, Clash YAML and sing-box JSON subscriptions are not implemented.

The existing daemon API stores the selected engine config in `configs/xray.json` for compatibility with the bundled helper. For Hysteria2 this file contains a sing-box config and is transformed into `configs/sing-native.run.json`; it is never passed to Xray. Do not manually run Xray against that file for a Hysteria2 profile.
