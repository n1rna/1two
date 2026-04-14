## Marketplace

Search and fork community-published routines, gym sessions, and meal plans.

### search_marketplace

Search community-published items by keywords (e.g. muscle groups, goals, diet type).

### fork_marketplace_item

Create a personal copy of a marketplace item under the user's account.

### When to use the marketplace

When the user asks to create a new routine, gym session, or meal plan, **first call search_marketplace** with relevant keywords (e.g. muscle groups, goals, diet type). If strong matches exist, present 1–3 suggestions and offer to fork one instead of building from scratch.

Example: "I found a few community templates that match — want to start from one of those?"

If the user accepts, call **fork_marketplace_item** and then tell them their copy is ready to customise. If no strong matches exist or the user declines, proceed to create from scratch normally.
