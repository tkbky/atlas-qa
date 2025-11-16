import { runCollectFieldInfoRepro } from "./utils.js";

runCollectFieldInfoRepro("stackoverflow", {
  targetUrl: "https://stackoverflow.com/questions",
  selectors: [
    "css=#search input[name='q']",
    "css=form[action='/search'] input[name='q']",
  ],
}).catch((err) => {
  console.error("StackOverflow repro failed", err);
  process.exit(1);
});
