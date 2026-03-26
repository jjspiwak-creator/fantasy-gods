import { Router, type IRouter } from "express";
import healthRouter from "./health";
import espnRouter from "./espn";
import tradesRouter from "./trades";

const router: IRouter = Router();

router.use(healthRouter);
router.use(espnRouter);
router.use(tradesRouter);

export default router;
