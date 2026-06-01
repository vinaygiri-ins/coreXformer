# CoreXformer Google Lead Map Module

## Purpose

This private owner-only module should help CoreXformer:
- discover schools, colleges, employer companies, communities, and government anchors
- search by visible area or radius from a selected point
- get results closer to Google Maps than the current OSM/Overpass version
- convert discovered places into saved outreach leads

## Why the current OSM version is not enough

The current Lead Map uses OpenStreetMap and Overpass. That is useful for lightweight discovery, but it does not reliably match the breadth of Google Maps, especially for:
- employer-type companies
- IT and services firms
- manufacturing and industrial organizations
- institution-dense urban clusters

If the expectation is:

`show me results closer to Google Maps`

then this module should move to a Google-based architecture.

## Recommended Google services

### Maps JavaScript API

Use for:
- rendering the private map
- map interaction
- markers
- selected point handling
- radius display

### Places API (New)

Use both:
- `searchNearby`
- `searchText`

`searchNearby` is best for:
- schools
- colleges
- universities
- radius scans
- visible area scans

`searchText` is best for:
- IT company
- software company
- manufacturing company
- engineering company
- industrial company
- corporate office

This hybrid is important because employer discovery is often better through text-based queries than through one strict place type.

## Official references

- Nearby Search: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchNearby
- Text Search: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/searchText
- Place Types: https://developers.google.com/maps/documentation/places/web-service/place-types
- Places Policies: https://developers.google.com/maps/documentation/places/web-service/policies?hl=en
- Google Maps Platform Terms: https://cloud.google.com/maps-platform/terms

## Required private studio behavior

### Scan modes

1. `Visible area`
2. `Radius from point`

### Category filters

- Schools
- Colleges
- Employer companies
- Communities
- Government

### Employer presets

Optional quick presets:
- IT / software
- Manufacturing
- Engineering
- Corporate offices
- Logistics / services

## Saved lead model

Store:
- `place_id`
- `name`
- `category`
- `address`
- `phone`
- `website`
- `lat`
- `lng`
- `status`
- `priority`
- `contact_person`
- `next_follow_up`
- `product_fit`
- `notes`
- `created_at`
- `updated_at`

Important rule:

Store primarily:
- `place_id`
- CoreXformer’s own notes and CRM fields

Do not design this as a copied permanent public Google directory.

## Build phases

### Phase 1

Prepare the studio for Google configuration:
- provider config
- API key placeholder
- map id placeholder

### Phase 2

Replace OSM discovery with Google discovery:
- Google map
- nearby search
- text search
- merged and deduped results

### Phase 3

Move saved leads from local storage into Supabase:
- cross-device access
- follow-up tracking
- product-fit tagging
- relationship history

## What is required before coding the live Google version

1. Google Cloud project
2. Billing enabled
3. APIs enabled:
   - Maps JavaScript API
   - Places API
4. API key
5. domain restrictions
6. optional Map ID

## Current repo preparation

The studio config now has a `leadMap` config block ready for:
- provider
- Google Maps API key
- Google Map ID
- region
- language

That means the codebase is prepared for the Google transition, but the real implementation should begin only after the key and billing are ready.
