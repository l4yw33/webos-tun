# Architecture

```text
webOS UI -> localhost HTTP -> xraytun-daemon -> shell scripts -> Xray/sing-box/TUN
```

The webOS UI is unprivileged. Root operations are executed by `xraytun-daemon`, a small local helper that listens on `127.0.0.1:17999`.

Homebrew `exec` is used only to start the helper when the app opens and the helper is offline. Regular VPN actions do not call Homebrew `exec`.

## Runtime directories

```text
/home/root/webos-xray-tun/bin       user binaries and helper daemon
/home/root/webos-xray-tun/scripts   runtime scripts copied from the app
/home/root/webos-xray-tun/configs   generated Xray and sing-box configs
/home/root/webos-xray-tun/profiles  user profile files
/home/root/webos-xray-tun/logs      runtime logs
/home/root/webos-xray-tun/state     resolved route state
```

## Network flow

```text
TV traffic -> tun0 -> sing-box TUN inbound -> SOCKS 127.0.0.1:10808 -> Xray -> remote proxy server
```

A host route to the proxy server is installed before the default route is moved to `tun0`. This prevents Xray from routing its own server connection back into the tunnel.
