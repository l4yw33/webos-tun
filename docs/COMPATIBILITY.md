# Compatibility

Compatibility depends on root access, Homebrew Channel, TUN support, CPU architecture and working Xray/sing-box binaries.

## Tested

| TV model | webOS | Kernel | CPU | TUN | Status |
| --- | --- | --- | --- | --- | --- |
| LG OLED55C6V | 3.4.0 | 3.16.7 | armv7l | yes | Working |

## Expected requirements

- rooted LG webOS TV;
- Homebrew Channel root service;
- `/dev/net/tun`;
- `ip` command with route support;
- compatible `xray` binary;
- compatible `sing-box` binary;
- compatible `xraytun-daemon` binary for the TV CPU architecture;
- local app access to `http://127.0.0.1:17999`.

## Not supported

- unrooted TVs;
- LG Content Store installation;
- TVs without `/dev/net/tun`;
- unsupported CPU architectures without matching binaries.

## Reporting a new model

Run:

```sh
sh /home/root/webos-xray-tun/scripts/diagnose.sh
```

Attach the output to the compatibility issue. Do not attach real profile URLs.
