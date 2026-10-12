# Group Outing Planner

Pick one place a whole friend group will enjoy. Each friend lists a few favourites (artists, films,
restaurants, brands). The app uses the Qloo taste graph to score places for each friend separately,
then merges the scores so nobody is left out.

Built for the Qloo Agentic Hackathon.

## How it works
1. Resolve each favourite to a Qloo entity (`/search`).
2. Build a candidate pool of places for the whole group (`/v2/insights`, `filter.type=urn:entity:place`).
3. Score the same candidates for each friend (`filter.results.entities`, `feature.explainability`).
4. Merge: `combined = alpha * mean + (1 - alpha) * min` (see `lib/merge.ts`).

Without `QLOO_API_KEY` the app runs in **mock mode** with made-up places so you can work on the UI.

## Run it
```bash
npm install
cp .env.example .env.local   # add your Qloo hackathon key
npm run dev                  # http://localhost:3000
npm test                     # merge algorithm tests
```

## Notes
- Hackathon keys only work against `https://hackathon.api.qloo.com`.
- Qloo response data is cached privately on the server and must not be committed to this repo.

## AI assistance
_Fill this in honestly before submitting: which tools you used, and which parts you wrote yourself._

## License
MIT, see `LICENSE`.
