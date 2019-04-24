FROM node:carbon-alpine AS builder

WORKDIR /opt/drone-supervisor

COPY package.json yarn.lock ./
RUN yarn

COPY . .

RUN yarn build

FROM node:carbon-alpine

WORKDIR /opt/drone-supervisor

COPY --from=builder /opt/drone-supervisor/dist ./dist
COPY --from=builder /opt/drone-supervisor/node_modules ./dist
COPY --from=builder /opt/drone-supervisor/package.json /opt/drone-supervisor/yarn.lock ./

RUN yarn install --production

CMD "node" "dist/index.js"
