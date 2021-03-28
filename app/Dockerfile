FROM node:14 as build_image

ENV PORT=$PORT
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci


COPY config/ config/
COPY scripts/ scripts/

COPY src/ src/
COPY public/ public/
COPY *.json ./

RUN npm run build


FROM nginx:stable-alpine as deploy_image


COPY --from=build_image /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template


