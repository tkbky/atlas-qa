import { runCollectFieldInfoRepro } from "./utils.js";

runCollectFieldInfoRepro("craigslist", {
  targetUrl: "https://accounts.craigslist.org/login",
  selectors: [
    "css=input#inputEmailHandle",
    "css=input#inputPassword",
    "css=button[type='submit']",
  ],
}).catch((err) => {
  console.error("Craigslist repro failed", err);
  process.exit(1);
});
