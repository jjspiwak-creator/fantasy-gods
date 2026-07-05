import { Router, type IRouter } from "express";
import healthRouter from "./health";
import espnRouter from "./espn";
import tradesRouter from "./trades";
import authRouter from "./auth";
import adminRouter from "./admin";
import metricsRouter from "./metrics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(metricsRouter);
router.use(espnRouter);
router.use(tradesRouter);

export default router;
