# Runtime binaries

Xray TUN for webOS does not include Xray-core or sing-box runtime binaries.

Users must provide binaries matching their TV CPU architecture.

## Official sources

- Xray-core releases: https://github.com/XTLS/Xray-core/releases
- sing-box releases: https://github.com/SagerNet/sing-box/releases

## Tested target

The tested TV reports:

```sh
uname -m
```

```text
armv7l
```

For this target use Linux ARMv7 builds.

## Required TV paths

Copy binaries to:

```text
/home/root/webos-xray-tun/bin/xray
/home/root/webos-xray-tun/bin/sing-box
```

Set executable permissions:

```sh
chmod +x /home/root/webos-xray-tun/bin/xray
chmod +x /home/root/webos-xray-tun/bin/sing-box
```

Verify:

```sh
/home/root/webos-xray-tun/bin/xray version
/home/root/webos-xray-tun/bin/sing-box version
```

## Helper daemon

The release IPK includes `xraytun-daemon` built for `linux/armv7`.

Source path:

```text
app/daemon-src/main.go
```

Output path in the IPK/runtime:

```text
app/bin/xraytun-daemon
/home/root/webos-xray-tun/bin/xraytun-daemon
```

For other CPU architectures, rebuild the daemon and provide matching Xray-core and sing-box binaries.
