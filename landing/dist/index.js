"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const router_1 = __importDefault(require("./router"));
const app = new hono_1.Hono()
    .route("/", router_1.default);
(0, node_server_1.serve)({
    fetch: app.fetch,
    port: 3000,
});
