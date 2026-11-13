# Security

Read docs/SECURITY-REVIEW.md for the changes and their verification limits.
The helper must listen only on 127.0.0.1:17999. New source requires a per-process token and validates Host/Origin/method. Tokens and VPN credentials must never be published. Another root process remains outside the isolation boundary.

This source distribution contains no helper binary: build it using build.ps1 or GitHub Actions. Do not reinsert the old unauthenticated binary. The current helper/UI were built and checked on OLED55C6V; see SUBSCRIPTIONS-SECURITY.md for scope and remaining limits.

Report vulnerabilities privately; do not attach raw profiles or unreviewed logs.
