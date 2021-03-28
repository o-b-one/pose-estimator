FROM node:14 as build_image

ENV PORT=$PORT
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

COPY src/ src/
COPY public/ public/
COPY *.json ./
# WORKAROUND until solving prod build issue with workers
CMD npm run start
#RUN npm run build


#FROM nginx:stable-alpine as deploy_image


# COPY --from=build_image /app/build /usr/share/nginx/html
# COPY nginx.conf /etc/nginx/templates/default.conf.template


