FROM node:lts-alpine3.21

RUN apk add --no-cache bash

RUN mkdir -p /app

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN npm install d3

COPY . .

EXPOSE 3000

CMD ["/bin/sh", "./entryscript.sh"]