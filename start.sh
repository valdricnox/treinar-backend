#!/bin/bash
# Roda migrations e inicia o servidor
node src/models/db.js && node src/models/seed.js; node src/server.js
