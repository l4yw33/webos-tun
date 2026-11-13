# Release guide

This document describes the GitHub release flow for `v1.2.3-alpha`.

## 1. Prepare repository

```powershell
cd C:\path\to\webos-xray-tun
git init
git add .
git commit -m "Initial alpha release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/webos-xray-tun.git
git push -u origin main
```

## 2. Build IPK

```powershell
cd C:\path\to\webos-xray-tun\app
ares-package.cmd .
```

Expected output:

```text
com.webosbrew.xraytun_1.2.3_all.ipk
```

## 3. Calculate release metadata

```powershell
Get-FileHash .\com.webosbrew.xraytun_1.2.3_all.ipk -Algorithm SHA256
(Get-Item .\com.webosbrew.xraytun_1.2.3_all.ipk).Length
```

## 4. Create Git tag

```powershell
git tag v1.2.3-alpha
git push origin v1.2.3-alpha
```

## 5. Create GitHub release

Release title:

```text
Xray TUN for webOS v1.2.3-alpha
```

Release tag:

```text
v1.2.3-alpha
```

Attach:

```text
com.webosbrew.xraytun_1.2.3_all.ipk
```

Release notes:

```markdown
Initial alpha release.

Tested device:
- LG OLED55C6V
- webOS 3.4.0
- Linux 3.16.7
- armv7l

Supported profiles:
- Trojan gRPC/TLS
- Trojan WebSocket/TLS

Requirements:
- rooted LG webOS TV
- Homebrew Channel root service
- /dev/net/tun
- user-provided Xray-core binary
- user-provided sing-box binary
```

## 6. Optional Homebrew apps-repo submission

After the GitHub release is available, create a manifest JSON and submit a package YAML to `webosbrew/apps-repo`.

Use the real release URL, IPK size and SHA256 hash.
