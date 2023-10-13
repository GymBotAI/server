#!/usr/bin/env bash

# This script is run by the Replit run button.

# Default NODE_ENV to development
if [ -z "$NODE_ENV" ]; then
  NODE_ENV=development
fi

# Run server depending on env
if [ "$NODE_ENV" = "production" ]; then
  bun prod
else
  bun dev
fi
