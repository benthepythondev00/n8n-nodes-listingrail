# n8n-nodes-listingrail

n8n community nodes for [Listingrail](https://listingrail.com), a real estate listings API: one key returns live sale and rental listings from 22 property portals (Zillow, Realtor.com, Redfin, Rightmove, Zoopla, Idealista, Funda, ImmoScout24 and more) in one JSON shape.

- **Listingrail Trigger**: starts a workflow when a Listingrail monitor finds a **new listing** or a **price drop**.
- **Listingrail**: search listings, get a listing's details or price history, create and manage monitors, list the portals.

Step-by-step setup guide: [n8n property alerts](https://listingrail.com/guides/n8n-property-alerts/).

## Installation

Self-hosted n8n, from the GitHub release (works now):

```bash
cd ~/.n8n/nodes
npm install https://github.com/benthepythondev00/n8n-nodes-listingrail/releases/download/0.1.0/n8n-nodes-listingrail-0.1.0.tgz
# then restart n8n
```

Once the package is on npm: **Settings > Community Nodes > Install**, enter `n8n-nodes-listingrail`, and confirm. See the [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/installation/).

On n8n Cloud, community nodes appear only after n8n verifies them. Until then, use the HTTP Request workflow from the [guide](https://listingrail.com/guides/n8n-property-alerts/#no-node), which needs no install.

## Credentials

1. Get an API key at [listingrail.com](https://listingrail.com/#key). A free key gives 250 listings a month and needs no card.
2. In n8n, create a **Listingrail API** credential and paste the key (it starts with `re_`).

The credential test calls `GET /v1/account`, which uses no credits.

## Listingrail Trigger

The trigger reads a **monitor**: a saved search (portal, location, filters) that Listingrail checks once a day at 06:20 UTC and compares with the previous check by the portal's own listing id. Create one at [listingrail.com/monitors](https://listingrail.com/monitors/) or with the Listingrail node (Monitor > Create).

| Event | Emits |
|-------|-------|
| New Listing | one item per listing the monitor had not seen before, with every field of the search API |
| Price Drop | one item per listing whose price went down: `id`, `url`, `title`, `address`, `postal_code`, `beds`, `price`, `old_price`, `new_price`, `drop_amount`, `drop_percent` |

Every item also carries `event`, `monitor_id`, `monitor_source`, `monitor_location` and `checked_at`.

- Polling reads the stored result and uses **no credits**. Hourly polling is enough, since the monitor itself runs daily.
- Each check is emitted once. The first check of a new monitor lists every listing as new, so it is skipped unless you turn on **Include First Check**.
- A price rise is not a price drop and is not emitted.
- Credits: a daily check uses one credit per listing it reads (up to the monitor's limit). On the Feed plan checks are included.

## Listingrail node operations

| Resource | Operation | Endpoint | Credits |
|----------|-----------|----------|---------|
| Listing | Search | `POST /v1/listings/search` | 1 per listing returned |
| Listing | Get Details | `POST /v1/listings/details` | 1 |
| Listing | Get Price History | `GET /v1/listings/{source}/{id}/history` | 0 (paid plans) |
| Monitor | Create / Get Many / Get Changes / Delete | `/v1/monitors` | 0 (checks are charged when they run) |
| Source | Get Many | `GET /v1/sources` | 0 |

A search with no results, or one the portal fails, is not charged.

## Workflow templates

Import from **Workflows > Import from File**:

- [`templates/listingrail-new-listing-email-slack.json`](templates/listingrail-new-listing-email-slack.json): new listing → email, plus Slack (disabled until you pick a channel).
- [`templates/listingrail-price-drop-google-sheet.json`](templates/listingrail-price-drop-google-sheet.json): price drop → a row in Google Sheets.

## Compatibility

Built with `@n8n/node-cli` (n8n nodes API version 1) and run on n8n 2.47. No runtime dependencies.

## Development

```bash
npm ci
npm run lint
npm test        # builds, then runs the unit tests of the trigger logic
npm run dev     # n8n with this node loaded, on http://localhost:5678
```

Releases are published to npm by `.github/workflows/publish.yml` with npm provenance when a version tag is pushed (`npm run release`).

## License

[MIT](LICENSE)
