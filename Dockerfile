FROM node:22-alpine as builder

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app ./

CMD ["npm", "run", "start"]