import { Router, type IRouter } from "express";
import healthRouter from "./health";
import espnRouter from "./espn";
import tradesRouter from "./trades";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(espnRouter);
router.use(tradesRouter);

export default router;
