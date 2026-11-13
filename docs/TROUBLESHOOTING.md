# Troubleshooting

## Daemon offline

Check manually:

```sh
pidof xraytun-daemon
wget -T 5 -Y off -O - http://127.0.0.1:17999/health
```

Start manually:

```sh
sh /home/root/webos-xray-tun/scripts/start-daemon.sh
```

## VPN shows ON but internet does not work

Check route and logs:

```sh
ip route
sh /home/root/webos-xray-tun/scripts/status.sh
tail -n 80 /home/root/webos-xray-tun/logs/xray.log
tail -n 80 /home/root/webos-xray-tun/logs/singbox.log
```

There must be a host route to the proxy server through the physical gateway, for example:

```text
SERVER_IP via LAN_GATEWAY dev eth0
```

## Restore network

Use the app button `Fix network` or run:

```sh
sh /home/root/webos-xray-tun/scripts/fix-network.sh
```

## Collect sanitized logs

```sh
sh /home/root/webos-xray-tun/scripts/collect-logs.sh
```

Attach the generated archive from `/tmp`. Review it before publishing.
