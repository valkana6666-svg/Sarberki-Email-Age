FROM node:22.17.0-bookworm-slim
WORKDIR /app
# No npm install, runtime packages, database credentials or recovery archives.
COPY *.mjs ./
COPY shared-core/*.mjs ./shared-core/
COPY netlify/functions/booking-cases.mjs ./netlify/functions/booking-cases.mjs
COPY netlify/functions/availability-options.mjs ./netlify/functions/availability-options.mjs
COPY price-source/sarberki-public-booking.mjs ./price-source/sarberki-public-booking.mjs
COPY business/sarberki/profile.mjs ./business/sarberki/profile.mjs
COPY scripts/isolated-persistent-server.mjs ./scripts/
COPY deployment/isolated-approval/public/ ./deployment/isolated-approval/public/
# Compose file secrets use their host ownership/mode; UID1000 requires explicit
# read-only ownership on the three application secrets before starting.
USER node
EXPOSE 8080
CMD ["node", "scripts/isolated-persistent-server.mjs"]
