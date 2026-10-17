# Group Outing Planner

**Live demo: https://group-outing-planner.vercel.app/**

Built for the Qloo Agentic Hackathon.

Picking a place for a group is hard. Everyone likes different things, so the group either follows
the loudest voice or settles for something generic. Group Outing Planner takes each friend's
favourite artists, films, restaurants and brands, asks Qloo's taste graph how well each place fits
each friend, and returns the places that work for everyone. It also shows who has the lowest match,
so nobody is quietly left out.

## What you get

For each of the top 3 places:
- A Qloo match percent for every friend.
- "via ..." lines showing which of that friend's favourites pushed the place up (Qloo explainability).
- Qloo tags for the place and a short summary built from that data.
- Who has the lowest match.

Inputs: 2 to 6 friends with up to 5 favourites each, a city, an outing type (dinner, cafe, drinks,
museum, park), a budget level, and optional free-text wishes such as "quiet, vegetarian options".

## How it uses Qloo

1. **Resolve favourites.** `/search` turns each typed favourite into a Qloo entity. The page shows
   how Qloo read every favourite.
2. **Candidate pool.** `/v2/insights` with `filter.type=urn:entity:place`, `filter.location.query`,
   the outing's genre tag in `filter.tags`, sub-types to leave out in `filter.exclude.tags`,
   `filter.price_level.max`, and the whole group's favourites as `signal.interests.entities`.
3. **Per-friend scoring.** The same candidates are scored separately for each friend with
   `filter.results.entities` and `feature.explainability=true`.
4. **Fair merge** (`lib/merge.ts`): `combined = alpha * mean + (1 - alpha) * min`. Each friend's
   scores are first centred on their own average, because Qloo affinities sit at different levels
   for different people. Without this, the friend with generally lower scores would decide every pick.

Qloo supplies the ranking, the per-friend scores, the tags and the explanations. Without Qloo the
app has nothing to show.

## The AI layer (optional, opt-in)

The app works fully without any LLM. If `GEMINI_API_KEY` is set, two things become available:

- **Agent for free-text wishes** (`lib/agent.ts`). Gemini gets two tools. `find_tags` searches Qloo
  `/v2/tags` for real tags, and `finish` returns the chosen tag IDs. The model can only use tag IDs
  that Qloo returned, so an invented or injected ID never reaches a filter. Wanted tags become
  `signal.interests.tags` (a soft preference) and tags to avoid become `filter.exclude.tags`.
  The "What the agent did" panel shows every step.
- **Comparison.** A checkbox shows what an LLM suggests for the same group with no Qloo data, next
  to the Qloo picks. The model's suggestions come from memory and can be wrong or invented.

Gemini also writes a one-sentence explanation per pick when wishes are given. It only sees Qloo's
numbers and tags. A plain run (no wishes, no comparison) makes no Gemini calls.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev                  # http://localhost:3000
npm test                     # 24 tests: merge, agent, Qloo client, outings, helpers
```

| Variable | Needed | Notes |
|---|---|---|
| `QLOO_API_KEY` | for live data | Without it the app runs in mock mode with made-up places |
| `QLOO_API_URL` | no | Defaults to `https://hackathon.api.qloo.com` |
| `GEMINI_API_KEY` | no | Enables the agent, explanations and comparison |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest` |

`/api/health` reports whether the variables look usable. It never returns a key.

## Project layout

```
app/page.tsx            UI
app/api/plan/route.ts   request validation, rate limit, mock mode
lib/qloo.ts             Qloo client (X-Api-Key, retry on 429, private cache)
lib/plan.ts             the pipeline above
lib/merge.ts            fair merge of per-friend scores
lib/outings.ts          outing type -> Qloo tags
lib/agent.ts            tool-calling agent for free-text wishes
lib/explain.ts          Qloo-only explanations and the LLM-only comparison
lib/gemini.ts           small Gemini REST client
```

## Limitations

- Qloo's tags are sometimes loose. For example a museum with a bar can show up under "Drinks".
- Gemini calls run on a free quota that can run out. When it does, the app says so and still shows
  the Qloo picks with data-based summaries.
- The rate limit is in memory and per server instance.
- Qloo response data is cached privately on the server and is not stored in this repository.

## AI assistance

_Edit this section so it is accurate for you before you submit._

- **At runtime:** Google Gemini is used for the optional agent, explanations and comparison described above.
- **While building:** most of the code was written with Claude (Anthropic's AI assistant) in a long
  chat. I ran it, tested it against the real Qloo API, debugged the deployment and API limits, and
  decided what to change.
- **[Add here which parts you wrote or changed yourself, and what you can explain without help.]**

## License

MIT, see `LICENSE`.
