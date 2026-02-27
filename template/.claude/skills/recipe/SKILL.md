---
name: recipe
description: App architecture recipes for AppyStack projects. Use when a developer wants to build a specific type of application on top of the RVETS template — e.g. "I want to build a CRUD app", "I want a sidebar navigation layout", "what kind of app can I build?", "help me set up a nav-shell app", "build me a file-based entity system". Presents a concrete build prompt for the chosen recipe and asks for confirmation before building.
---

# Recipe

## Overview

Recipes are app architecture patterns that sit on top of the AppyStack RVETS template. Each recipe defines a specific structural shape — layout, data strategy, Socket.IO usage — that Claude scaffolds into the project.

## Available Recipes

| Recipe | When to use |
|--------|-------------|
| `nav-shell` | App with left sidebar nav, header, and a main content panel that switches based on nav selection |
| `file-crud` | App with multiple entities stored as JSON files, Socket.IO sync, and CRUD screens |

See `references/nav-shell.md` and `references/file-crud.md` for full pattern details.

## Flow

1. **Identify** which recipe fits. If the developer's intent is unclear, ask: "What kind of app are you building?" and present the available recipes with one-line descriptions.
2. **Load** the relevant reference file for the chosen recipe.
3. **Generate** a concrete build prompt — specific file structure, component names, data shapes, Socket.IO events — tailored to this project.
4. **Present** the prompt: "Here's what I'll build: ..." Keep it concrete and specific, not generic.
5. **Ask**: "Shall I go ahead?"
6. **Build** on confirmation, following the patterns in the reference file.

## Notes

- Recipes can be combined. If the developer wants nav-shell + file-crud, load both references and merge the patterns.
- The generated prompt is a useful artifact — if the developer says "not quite", refine it before building rather than starting over.
- Keep the prompt grounded in what's already in the template. Don't introduce new dependencies unless the recipe explicitly calls for them.
