# services.json schema (Person B)

One object per service. Retrieval chunks are built from these fields (one chunk per service).

| Field | Type | Notes |
|---|---|---|
| id | string | Stable id, e.g. `svc_017` |
| name | string | German name |
| description | string | What the service does, in plain German |
| topics | list[string] | e.g. `["Pflege", "Angehörige", "Beratung"]` |
| target_group | list[string] | Who it is for |
| city | string | Location |
| address, phone, email, website, opening_hours | string | Contact details |
| languages | list[string] | `["de", "en"]` |

`services.sample.json` contains **placeholder** entries only. Replace with real Caritas data.
