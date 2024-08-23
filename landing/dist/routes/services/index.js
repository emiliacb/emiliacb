"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const path_1 = __importDefault(require("path"));
const html_1 = require("hono/html");
const layout_1 = __importDefault(require("../../components/layout"));
const content_1 = require("../../services/content");
function handler(c) {
    return __awaiter(this, void 0, void 0, function* () {
        const filePath = path_1.default.join(__dirname, `./content.md`);
        const htmlContent = yield (0, content_1.getContent)(filePath);
        const view = (0, layout_1.default)({
            siteData: {
                title: "services | emiliacb",
            },
            children: (0, html_1.html) `<div class="prose prose-stone dark:prose-invert">
      ${(0, html_1.raw)(htmlContent)}
    </div>`,
        });
        return c.html(view);
    });
}
