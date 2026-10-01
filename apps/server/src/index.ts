import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
    return c.json({
        message: "Smart Attendance API",
        status: "running"
    });
});

export default app;