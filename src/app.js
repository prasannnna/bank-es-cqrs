import express from "express";
import { commandsRouter } from "./routes/commands.js";
import { queriesRouter } from "./routes/queries.js";
import { projectionsRouter } from "./routes/projections.js";

export const app = express();

app.use(express.json());

app.use(commandsRouter);
app.use(queriesRouter);
app.use(projectionsRouter);
