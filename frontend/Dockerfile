FROM node:lts-alpine3.21

RUN apk add --no-cache bash

RUN mkdir -p /app

WORKDIR /app

COPY package*.json ./

RUN npm install
RUN npm i react-split
RUN npm install --save react-split
RUN npm install d3
RUN npm install d3-sankey
RUN npm install d3-chord

COPY . .

EXPOSE 3000

CMD ["/bin/sh", "./entryscript.sh"]