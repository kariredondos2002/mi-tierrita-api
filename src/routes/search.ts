import { Router } from "express";
import { searchController } from "../controllers/search/index";

export const searchRouter = Router();
searchRouter.get("/", searchController);
