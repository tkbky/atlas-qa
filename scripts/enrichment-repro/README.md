# Enrichment Repro Scripts

These scripts exercise `collectFieldInfo()` against a set of public sites so you can quickly validate DOM enrichment changes without running a full Atlas flow.

## Available scripts

| Script | Scenario |
| --- | --- |
| `hn-login.ts` | Hacker News login/create-account form at `https://news.ycombinator.com/login?goto=news` |
| `neocities-login.ts` | Neocities sign-in form at `https://neocities.org/signin` |
| `craigslist-login.ts` | Craigslist account login page |
| `lobsters-login.ts` | Lobsters login form |
| `stackoverflow-search.ts` | StackOverflow questions page search box |
| `ao3-tag-search.ts` | Archive Of Our Own tag search form |

Each script logs the first simple field it sees (to confirm `page.evaluate` works) and then prints the serialized `FormFieldInfo` objects for the provided selectors. Any thrown errors indicate a regression in enrichment.

## Running a script

```bash
# From the repo root
npx tsx scripts/enrichment-repro/hn-login.ts
```

Replace `hn-login.ts` with whichever scenario you want to probe.

## Prompt for debugging

You can drop this into Codex (or any coding agent) when investigating enrichment issues:

```
We suspect collectFieldInfo is broken. Run every script in scripts/enrichment-repro/, collect the console output, and summarize which selectors failed. If anything errors, debug the enrichment logic until all scripts succeed.
```
