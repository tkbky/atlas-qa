import { runCollectFieldInfoRepro } from "./utils.js";

runCollectFieldInfoRepro("lobsters", {
  targetUrl: "https://lobste.rs/login",
  selectors: [
    "css=input#email",
    "css=input#password",
    "css=input[name='commit']",
  ],
}).catch((err) => {
  console.error("Lobsters repro failed", err);
  process.exit(1);
});
