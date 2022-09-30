FROM node:14.16.1-alpine
RUN apk add --no-cache git gcc make g++ zlib-dev xfce4-dev-tools postgresql-client cairo-dev pango-dev && mkdir /app
RUN apk add --no-cache  chromium --repository=http://dl-cdn.alpinelinux.org/alpine/v3.10/main

# missing chromium dependency for Puppeteer
RUN apk add libjpeg-turbo-dev

WORKDIR /app
# We need to add package.json in separate step to get node_modules as separate docker layer and cache it
ADD ./package.json ./package.json

# Run yarn install separately from build to get node_modules as separate docker layer and cache ti
RUN yarn install --production=false --no-lockfile

ADD . ./
RUN yarn build

# added this to fix error: Incorrect hash when fetching from the cache for "wyvern-js"
RUN yarn cache clean 

# Cleanup development packages
RUN yarn install --prefer-offline --frozen-lockfile --production --unsafe-perm --ignore-optional

ENTRYPOINT ["node", "build/src/index.js"]
