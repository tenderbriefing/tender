FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
ENV NODE_ENV=production
ENV UPSTREAM_URL=https://tenderbriefing-xzgs5uw5ta-bq.a.run.app
EXPOSE 8080
CMD ["node", "server.js"]
