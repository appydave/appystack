# App Naming

Naming conventions for standalone AppyStack applications and micro-apps in the RVETS ecosystem.

---

## The Pattern

AppyStack app names compound two real English words in PascalCase. Each word does its own job:

- One word encodes **what it operates on** (the subject/domain)
- One word encodes **what role it plays** (the action/function)

```
[What it operates on] + [What role it plays]
  — or —
[What role it plays] + [What it operates on]
```

| Name | Operates on | Role it plays | Double meaning |
|---|---|---|---|
| DeckHand | Deck (Stream Deck) | Hand (operator, helper) | Nautical deckhand who works the deck |
| AppyStack | Stack (tech stack) | Appy (brand + happy) | A branded happy stack of layers |
| ThumbRack | Thumb (thumbnail) | Rack (organiser/display) | Thumbnail rack + thumbtack connotation |

The name works on at least two levels simultaneously. When you understand what the app does, the name earns a small moment of recognition. It should feel slightly witty — not laboured, not literal.

---

## The Rules

**1. Two words, merged PascalCase, no hyphen**
`DeckHand` not `Deck-Hand` or `deckhand` or `Deck Hand`

**2. Approximately four syllables total**
2+2 (`DeckHand`, `AppyStack`) or 2+1 (`ThumbRack`) — short enough to say naturally, long enough to be distinct.

**3. One word used metaphorically, one grounding the domain**
The metaphor word borrows meaning from another context (a ship's deckhand, a storage rack, a stack of cards). The domain word pins it to what the app actually does.

**4. No generic words**
Avoid `App`, `Tool`, `Manager`, `System`, `Platform`, `Dashboard`. These add nothing and are forgettable.

**5. The name implies the function without spelling it out**
`DeckHand` does not say "Stream Deck controller". `ThumbRack` does not say "thumbnail manager". The implication is enough — and more memorable than the literal version.

**6. Physical and tangible — you can picture the thing**
A hand on a deck. A rack of photo cards. Layers stacked. The name evokes something you could touch, not an abstraction.

**7. Slightly witty, not cute**
There's a quiet intelligence to the name. It rewards a second of thought. It does not use puns, exclamation energy, or forced cleverness.

**8. Brand prefix only when published externally**
`AppyStack` carries "Appy" because it ships to npm and needs brand identity. Internal or private tools skip the brand prefix — `DeckHand` not `AppyDeckHand`.

---

## Suite Naming (Different Convention)

Product suites use a **brand prefix + function noun** pattern. This is separate from standalone app naming.

| Name | Prefix | Function |
|---|---|---|
| FliHub | Fli (FliVideo brand) | Hub (central store) |
| FliDeck | Fli | Deck (presentation deck) |
| FliGen | Fli | Gen (generator) |
| FliVoice | Fli | Voice |

Suite apps belong to a family and share the prefix. Standalone apps do not use a prefix.

**When to use suite naming vs standalone naming:**
- Suite: the app only makes sense as part of a larger product family
- Standalone: the app could exist independently, or belongs to no specific suite

---

## Package and Directory Names

Display name (PascalCase) maps to lowercase kebab-case for everything else:

| Display | Directory | npm package |
|---|---|---|
| DeckHand | `deckhand` | `@appydave/deckhand` |
| AppyStack | `appystack` | `@appydave/appystack` |
| ThumbRack | `thumbrack` | `@appydave/thumbrack` |

---

## Port Assignment

Always check the port registry before assigning ports to a new app:

```
~/dev/ad/brains/brand-dave/app-port-registry.md
```

Ports are assigned by zone (FliVideo suite, client apps, template zone, etc.). Do not pick ports by guessing.

---

## Checklist for a New Name

- [ ] Two words merged in PascalCase
- [ ] Four syllables or fewer
- [ ] One word is a common English noun used metaphorically
- [ ] One word grounds it in the actual domain
- [ ] Says nothing generic (`App`, `Tool`, `Manager`, etc.)
- [ ] Makes sense without explanation after a moment's thought
- [ ] Lowercase kebab-case works for directory and package names
- [ ] Port assigned from the registry
