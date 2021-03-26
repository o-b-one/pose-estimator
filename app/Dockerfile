FROM node:14 as build_image

WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

COPY src/ src/
COPY public/ public/
COPY *.json ./
RUN npm run build


FROM nginx:stable-alpine as deploy_image

COPY --from=build_image /app/build /usr/share/nginx/html
ENV NGINX_PORT=$PORT
EXPOSE $NGINX_PORT

