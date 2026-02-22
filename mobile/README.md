# VicPods Mobile Wrapper

This folder contains a Capacitor wrapper so the existing VicPods web app can run as native iOS/Android apps with the same UI and behavior.

## 1) Prerequisites

- Hosted VicPods web app over HTTPS (example: `https://app.vicpods.com`)
- Xcode installed for iOS builds
- Android Studio installed for Android builds
- Node.js 18+

## 2) Configure target URL

Edit `mobile/capacitor.config.json`:

- Set `server.url` to your production app URL.
- Keep HTTPS only (`cleartext: false`).

## 3) Install and scaffold native projects

```bash
cd mobile
npm install
npm run add:ios
npm run add:android
npm run sync
```

## 4) Open native IDE projects

```bash
npm run open:ios
npm run open:android
```

Build/sign/archive from Xcode and Android Studio for App Store / Play Store submission.

## 5) Important backend settings

Because auth uses session cookies, production should run with:

- `NODE_ENV=production`
- secure HTTPS on the app domain
- stable `SESSION_SECRET`
- `APP_URL` set to the same hosted domain used in mobile config

## 6) Stripe behavior in mobile

Stripe Checkout/Portal pages are external web flows. Validate the end-to-end return URLs from mobile and confirm store policy compliance for subscriptions.

## 7) Local testing with a device

If needed for testing without prod, expose local VicPods over HTTPS tunnel (for example ngrok/cloudflared), then temporarily point `server.url` to that tunnel URL.
