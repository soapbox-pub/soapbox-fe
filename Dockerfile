FROM node:16 as builder
ENV NODE_ENV=production
WORKDIR /app
COPY package.json yarn.lock /app/
RUN yarn install --ignore-scripts
COPY ./ /app/
RUN yarn build

FROM nginx:stable
COPY --from=builder /app/static/ /opt/soapbox/static/
COPY --from=builder /app/installation/docker.conf /etc/nginx/conf.d/default.conf
