# Backlog

Tickets referenced by the active work but not scheduled. They exist so the out-of-scope lists point somewhere real, and so nobody spends their forty minutes building one of them by accident.

## NWP-202 · Edit a card's spend limit after issue

**Type** Story · **Status** Backlog · **Priority** Medium

Ops can set a limit when issuing a card, but not change it afterwards. Today that means cancelling and reissuing, which breaks any vendor subscription already on the card.

Needs a decision on whether a limit change is retroactive against spend already recorded. Blocked on that answer.

Referenced as out of scope by [NWP-201](NWP-201.md).

## NWP-203 · Persist console data

**Type** Task · **Status** Backlog · **Priority** Medium

The console runs against an in-memory store seeded from JSON. Everything created in a session is gone when the process restarts, which is fine for demos and not fine for anything else.

Scope when it comes up: pick a store, move the seed into it, keep the route handlers unchanged behind the existing data access layer.

Referenced as out of scope by [NWP-201](NWP-201.md). **Do not build this during a workshop exercise.**

## NWP-204 · Webhook delivery log

**Type** Story · **Status** Backlog · **Priority** Low

Merchants ask why they did not receive an event. Support has no way to answer without asking engineering to check logs. A delivery log with retry would close most of those tickets.

## NWP-205 · Reconciliation view

**Type** Story · **Status** Backlog · **Priority** Medium

A screen that compares a payout's recorded net against the sum of its line items and shows the delta. Would have caught [NWP-102](NWP-102.md) before a merchant did.
# e2e submit-flow check 2026-09-03T14:10:35Z
