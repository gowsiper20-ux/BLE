import { Hono } from "hono";
import { PeriodService } from "../services/period.service";

export const periodRoutes = new Hono();
const service = new PeriodService();

periodRoutes.get("/", async (c) => {
  try {
    const data = await service.getPeriods();
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 500);
  }
});

periodRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.createPeriod(body);
    return c.json({ success: true, data }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: { code: error.message, message: error.message } }, 400);
  }
});

periodRoutes.patch("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const data = await service.updatePeriod(c.req.param("id"), body);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});

periodRoutes.delete("/:id", async (c) => {
  try {
    await service.deletePeriod(c.req.param("id"));
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: { message: error.message } }, 400);
  }
});
