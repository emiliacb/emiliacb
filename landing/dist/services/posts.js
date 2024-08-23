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
exports.getAllPosts = getAllPosts;
exports.getPost = getPost;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const marked_1 = require("marked");
const gray_matter_1 = __importDefault(require("gray-matter"));
function getAllPosts() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const directoryPath = path_1.default.join(__dirname, "../frontmatter");
            const files = fs_1.default.readdirSync(directoryPath);
            const posts = yield Promise.all(files
                .filter((file) => path_1.default.extname(file) === ".md")
                .map((file) => __awaiter(this, void 0, void 0, function* () {
                const filePath = path_1.default.join(directoryPath, file);
                const fileContent = fs_1.default.readFileSync(filePath, "utf8");
                const { data } = (0, gray_matter_1.default)(fileContent);
                data.slug = file.replace(".md", "");
                return data;
            })));
            return posts.filter((post) => !post.draft);
        }
        catch (error) {
            error.step = "getAllPosts";
            console.log(error);
            return null;
        }
    });
}
function getPost(slug) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const filePath = path_1.default.join(__dirname, `../frontmatter/${slug}.md`);
            const file = fs_1.default.readFileSync(filePath, "utf8");
            const { data, content } = (0, gray_matter_1.default)(file);
            const htmlContent = yield (0, marked_1.marked)(content);
            return { data, htmlContent };
        }
        catch (error) {
            error.step = "getPost";
            console.log(error);
            return null;
        }
    });
}
