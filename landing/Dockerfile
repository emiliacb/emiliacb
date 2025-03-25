FROM node:18-alpine

WORKDIR /

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
