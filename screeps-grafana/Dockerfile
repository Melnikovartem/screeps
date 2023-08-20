FROM node:lts

WORKDIR /app
COPY . /app
RUN npm install
# ENV SCREEPS_HOST=https://screeps.com

ENTRYPOINT [ "npm", "start" ]