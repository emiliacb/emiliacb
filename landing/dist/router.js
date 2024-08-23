"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const home_1 = __importDefault(require("./routes/home"));
const blog_1 = __importDefault(require("./routes/blog"));
const services_1 = __importDefault(require("./routes/services"));
const about_1 = __importDefault(require("./routes/about"));
const not_found_1 = __importDefault(require("./routes/not-found"));
const router = new hono_1.Hono();
router
    .get("/", home_1.default)
    .get("/about", about_1.default)
    .get("/blog/*", blog_1.default)
    .get("/services", services_1.default)
    .get("*", not_found_1.default);
exports.default = router;
