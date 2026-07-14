import { Router, type IRouter } from "express";
import healthRouter from "./health";
import espnRouter from "./espn";
import tradesRouter from "./trades";
import authRouter from "./auth";
import metricsRouter from "./metrics";
import manualLeaguesRouter from "./manualLeagues";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(metricsRouter);
router.use(espnRouter);
router.use(tradesRouter);
router.use(manualLeaguesRouter);

export default router;
