import { Router } from "express";
import { getNews } from "../controllers/rss.controller.js";

const router = Router();

router.get("/", getNews);

export default router;
