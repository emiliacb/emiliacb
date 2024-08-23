"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const router_1 = __importDefault(require("./router"));
const app = new hono_1.Hono().route("/", router_1.default);
const port = parseInt((_a = process.env.PORT) !== null && _a !== void 0 ? _a : "", 10) || 3000;
console.log(`\x1b[32mServer listening at port: \x1b[34m${port}\x1b[0m`);
(0, node_server_1.serve)({
    fetch: app.fetch,
    port,
});
