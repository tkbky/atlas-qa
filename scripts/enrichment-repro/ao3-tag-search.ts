import { runCollectFieldInfoRepro } from "./utils.js";

runCollectFieldInfoRepro("ao3-tags", {
  targetUrl: "https://archiveofourown.org/tags/search",
  selectors: [
    "css=#tag_search_name",
    "css=#tag_search_fandoms",
    "css=form[action='/tags/search'] input[type='submit']",
  ],
}).catch((err) => {
  console.error("AO3 tags repro failed", err);
  process.exit(1);
});
