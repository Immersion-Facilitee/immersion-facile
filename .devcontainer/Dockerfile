FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN \
  apt-get update \
  && apt-get install -y git curl ca-certificates unzip  \
  && apt-get clean  \
  && rm -rf /var/lib/apt/lists/*
