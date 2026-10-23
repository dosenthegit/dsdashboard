FROM node:lts-alpine

RUN apk add --no-cache \
    bash \
    curl \
    jq \
    iputils \
    tzdata

ENV TZ=Europe/Stockholm
ENV NODE_ENV=production

WORKDIR /app

COPY server.js package.json start.sh check-services.sh ./

RUN chmod +x /app/start.sh /app/check-services.sh \
    && mkdir -p /site /data/backups /app/public /app/defaults

COPY site/index.html site/app.js site/style.css /app/public/
COPY defaults/config.json /app/defaults/config.json

EXPOSE 3000

CMD ["/app/start.sh"]
