# The User Uncomfort

A gloriously unhelpful captcha marathon disguised as a game.

## What it is

- 50 levels of captcha chaos
- image captchas, random-fall captchas, luck captchas, and other little crimes against patience
- profile icons, avatars, themes, leaderboard nonsense, and a troll logout popup
- Firebase Google sign-in support

## Why it exists

Because sometimes the only correct UX is to make the user question their life choices, politely.

## Features

- Funky captcha-first game UI
- 50 challenge progression
- profile picture uploads from device
- username unlock after level 10
- leaderboard with top 5 plus your current rank if you're not famous yet
- light/dark mode
- restart with reseeded puzzle logic

## Tech Stuff

- React
- TypeScript
- Vite
- Firebase Authentication

## Run It

```bash
npm install
npm run dev
```

## Build It

```bash
npm run build
```

## Important

- The `.env` file is intentionally not included.
- If you want Google login to work locally, use `.env.local` on your machine.

## Final Note

If this app feels slightly rude, that means the captcha is working.
