#!/bin/sh

sudo ufw limit 22/tcp

sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw enable
sudo ufw status verbose