#!/bin/bash
set -euo pipefail
mock_dir="$(mktemp -d /tmp/webos-tun-test.XXXXXX)"
cat > "$mock_dir/ip" <<'MOCK'
#!/bin/sh
if [ "$1" = "-6" ]; then
  printf 'default via 2001:db8::1 dev test0\n2001:db8::/64 dev test0\n'
else
  printf 'default via 192.0.2.1 dev test0\n192.0.2.0/24 dev test0 src 192.0.2.10\n'
fi
MOCK
cat > "$mock_dir/uname" <<'MOCK'
#!/bin/sh
case "$1" in
  -s) echo Linux;;
  -m) echo armv7l;;
  *) echo private-test-host;;
esac
MOCK
chmod 700 "$mock_dir/ip" "$mock_dir/uname"
archive="$(PATH="$mock_dir:$PATH" sh app/scripts/collect-logs.sh)"
case "$archive" in /tmp/webos-tun-diagnostics.*/diagnostics.tar.gz) ;; *) echo 'Unexpected archive path'; exit 1;; esac
case "$(uname -s)" in
  MINGW*|MSYS*) echo 'POSIX mode check deferred to Linux CI';;
  *) test "$(stat -c '%a' "$(dirname "$archive")")" = 700;;
esac
contents="$(tar -xOzf "$archive" system.txt status.json README.txt)"
if printf '%s' "$contents" | grep -Eq '192\.0\.2|2001:db8|private-test-host|uid=|/dev/'; then
  echo 'Diagnostic archive includes sensitive fixture values'; exit 1
fi
printf '%s' "$contents" | grep -q 'IPv4 default routes: 1'
printf '%s' "$contents" | grep -q 'IPv6 default routes: 1'
echo 'PASS diagnostic archive: no fixture identifiers'
