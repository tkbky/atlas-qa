import { runCollectFieldInfoRepro } from "./utils.js";

runCollectFieldInfoRepro("neocities", {
  targetUrl: "https://neocities.org/signin",
  selectors: [
    "css=form[action='/signin'] input[name='username']",
    "css=form[action='/signin'] input[name='password']",
    "css=form[action='/signin'] input[type='submit']",
  ],
}).catch((err) => {
  console.error("Neocities repro failed", err);
  process.exit(1);
});
