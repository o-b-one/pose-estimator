FROM node:14 as build_image

ARG PORT
RUN echo $PORT


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

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN /bin/bash -c "envsubst '\$PORT' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf"

