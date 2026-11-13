#!/bin/sh
wget -T 8 -Y off -O - http://api.ipify.org 2>/dev/null | tr -d '\n\r'
echo
