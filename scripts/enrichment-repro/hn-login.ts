import { runCollectFieldInfoRepro } from "./utils.js";

const TARGET_URL = "https://news.ycombinator.com/login?goto=news";
const SELECTORS = [
  "xpath=/html[1]/body[1]/form[1]/table[1]/tbody[1]/tr[1]/td[2]/input[1]",
  "xpath=/html[1]/body[1]/form[1]/table[1]/tbody[1]/tr[2]/td[2]/input[1]",
  "xpath=/html[1]/body[1]/form[1]/input[2]",
  "xpath=/html[1]/body[1]/form[2]/table[1]/tbody[1]/tr[1]/td[2]/input[1]",
  "xpath=/html[1]/body[1]/form[2]/table[1]/tbody[1]/tr[2]/td[2]/input[1]",
  "xpath=/html[1]/body[1]/form[2]/input[3]",
];

runCollectFieldInfoRepro("hn-signup", { targetUrl: TARGET_URL, selectors: SELECTORS }).catch((err) => {
  console.error("Repro script failed", err);
  process.exit(1);
});
