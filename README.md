# TasteRoute

TasteRoute is a Qloo-powered cultural-routing agent. It turns a public cultural reference — an artist, film, book, or cuisine — into a city-aware outing route grounded in Qloo's taste graph.

## Live demo

Try the deployed application: [TasteRoute live demo](http://16.176.31.89:3000/)

## How the agent works

1. **Resolve** a cultural reference with Qloo search.
2. **Read** Qloo-derived taste tags and affinities for the resolved entity.
3. **Plan** a route by combining those signals with the user's city, mood, and selected goal.
4. **Rank** Qloo cultural places through the Insights API and show the decision trace alongside the recommendations.

Qloo is essential: without Qloo's entity graph, cultural tags, and taste-based place ranking, TasteRoute cannot generate its live route or explain its cultural grounding. Demo mode is explicitly labelled and exists only for interface review when live credentials are unavailable.

## Run locally

1. Install the official Qloo harness:
   ```sh
   npm install --global @qloo/qloo-harness
   ```
2. Copy `.env.example` to `.env` and set your event-issued key and endpoint:
   ```dotenv
   QLOO_API_KEY=your-event-key
   QLOO_BASE_URL=https://hackathon.api.qloo.com
   QLOO_TRUSTED_BASE_URL=https://hackathon.api.qloo.com
   ```
3. Run `npm start`, then visit `http://localhost:3000`.

## Testing

Submit a public reference such as `Khruangbin`, set a city and mood, then choose a route goal. A live route displays the Qloo-derived agent trace and three ranked cultural places.

Do not enter personal or sensitive data. Never commit a Qloo credential.
