import { app } from "./app.js";

const port = process.env.API_PORT || 8080;

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
