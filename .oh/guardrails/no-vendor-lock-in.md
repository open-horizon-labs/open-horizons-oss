---
id: no-vendor-lock-in
outcome: self-hostable-strategy-graph
severity: hard
statement: No Supabase, no Vercel, no external auth providers, no vendor-specific APIs.
---

## The Pattern

Everything runs on generic Postgres + Docker. No Supabase client libraries, no Vercel-specific
deployment features, no external authentication services.

## Override Protocol

None. This is the core value proposition — self-hostable means self-hostable.

## Evidence

The entire OSS fork exists because the original product was locked to Supabase + Vercel.
