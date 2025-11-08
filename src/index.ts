import { runAtlas } from "./atlas.js";

async function main() {
  const goal =
    "1. Login using email: gaurav@yopmail.com, password: Welcome@1. 2. Navigate to the lead management dashboard (either by clicking Marketing > Lead Management in the left menu, or by going directly to https://dev.mbodev.me/app/lead-management). 3. Explore and test filtering leads by different date ranges. Try various date range filters and verify how the leads are filtered based on the selected date ranges."
  await runAtlas(goal, "https://dev.mbodev.me/classic/ws?studioid=-1002002&launch=true", {
    env: "LOCAL",
    maxSteps: 10,
    beamSize: 3,
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
