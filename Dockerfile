FROM node:10-alpine AS builder

RUN apk --no-cache add python make gcc musl-dev g++ bash gdb nano git sqlite tini

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install --only=production

# Bundle app source
COPY . .

FROM node:10-alpine

COPY --from=builder /usr/src/app /usr/src/app
COPY --from=builder /sbin/tini /sbin/tini

RUN adduser -D duwww \
    && chown duwww.duwww /usr/src/app

WORKDIR /usr/src/app
    
USER duwww

EXPOSE 8080

ENV NODE_ENV=production
ENV DEBUG=*

ENTRYPOINT ["/sbin/tini", "--"]
CMD [ "node", "src/index.js" ]