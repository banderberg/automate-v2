# AutoMate — Google Play Store Launch Guide

**A step-by-step guide from zero to listed app.** Written for a first-time publisher using Expo + EAS Build.

---

## Key Concepts

### AAB vs APK
- **AAB (Android App Bundle)** is what Google Play requires for all new apps. Google generates device-optimized APKs from your AAB, reducing download size by ~40%. You cannot sideload an AAB directly.
- **APK** is the traditional single-file format. Your `eas.json` preview profile builds APKs for direct device testing, but Google Play won't accept APKs for new submissions.

### App Signing
Two keys are involved:
1. **Upload key** — managed by EAS, used to sign your AAB before uploading. Stored encrypted on Expo's servers.
2. **App signing key** — managed by Google, used to sign the final APKs delivered to users. Google holds this key.

If you ever lose the upload key, you can reset it through `eas credentials` + Google Play Console. Your app is never orphaned.

---

## Part 1: EAS Build Setup ✅

### 1.1 Install EAS CLI

```bash
npm install -g eas-cli
eas --version   # must be >= 16.0.0
```

### 1.2 Log in to Expo

```bash
eas login
```

Create a free account at https://expo.dev/signup if you don't have one.

### 1.3 Build the production AAB

```bash
eas build --platform android --profile production
```

What happens:
1. EAS uploads your project to Expo's build servers
2. On first build, it prompts: **"Generate a new Android Keystore?"** — select **Yes**
3. Build takes 10–15 minutes (up to 45 min on the free tier)
4. You get a download URL for the `.aab` file

Your `eas.json` has `"autoIncrement": true` on the production profile, so `versionCode` auto-increments with each build (Google rejects duplicate version codes).

Check build status:
```bash
eas build:list
```

---

## Part 2: Google Play Console Registration ✅

### 2.1 Create a developer account

1. Go to https://play.google.com/console/signup
2. Sign in with your Google account
3. Choose **Personal** account type
4. Pay the **one-time $25 registration fee**
5. Accept the Developer Distribution Agreement

### 2.2 Identity verification

Google requires:
- **Government-issued photo ID** (driver's license, passport, or national ID)
- Name on ID must match the credit card used for registration
- **Email** and **phone** verified via one-time passwords

Verification takes **2–7 business days**. You cannot create apps until approved.

---

## Part 3: Before You Submit — Preparation Checklist

Complete these before touching Google Play Console:

- [ ] **Host your privacy policy** at a public URL
  - Options: GitHub Pages, a public GitHub Gist, Netlify free tier, or any static host
  - Your policy is already drafted at `docs/PRIVACY-POLICY.md` — just host it
  - Google requires a live URL; a `.md` file in your repo won't work

- [ ] **Create graphic assets**
  - App icon: 512x512 PNG, no transparency, sRGB color space
  - Feature graphic: 1024x500 JPEG or PNG, no transparency
  - Phone screenshots: 1080x1920 minimum (16:9), 2–8 images
  - Each file under 8 MB

- [ ] **Build your production AAB** (Part 1 above)

- [ ] **Test on a real device**
  - Build a preview APK: `eas build --platform android --profile preview`
  - Install on your phone and test all flows

### Taking Screenshots

**Option A: Android Emulator (recommended)**
1. Install Android Studio, create a Pixel 8 emulator (1080x2400)
2. Run `npx expo start`, press `a` to open on emulator
3. Navigate to each screen, click the camera icon in the emulator toolbar

**Option B: Real Device**
1. Install the preview APK on your phone
2. Take screenshots with Power + Volume Down

**Making them store-ready:**
Raw screenshots work, but professional listings use device frames and headlines. Tools:
- **Figma** (free) — search "Play Store screenshot template" in Figma Community
- **AppMockUp** (appmockup.com) — web-based, free tier
- **Canva** (free tier) — app store screenshot templates

Your `docs/PLAY-STORE-LISTING.md` describes 8 screenshot compositions with headlines to use.

---

## Part 4: Creating the App Listing

### 4.1 Create the app

1. Open https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - App name: `AutoMate - Car Expense Tracker`
   - Default language: English (United States)
   - App or Game: **App**
   - Free or Paid: **Free**
4. Check the declaration boxes, click **Create app**

### 4.2 Store listing

Navigate to **Grow > Store presence > Main store listing**. Use the copy from `docs/PLAY-STORE-LISTING.md`:

| Field | Limit |
|-------|-------|
| App name | 30 chars |
| Short description | 80 chars |
| Full description | 4,000 chars |

Upload your icon, feature graphic, and screenshots.

### 4.3 Content rating

Navigate to **Policy > App content > Content rating**.

1. Select category: **"Utility, Productivity, Communication, or other"**
2. Answer the questionnaire — mostly "No" for AutoMate
3. Result will be **"Everyone"**

### 4.4 Data safety

Navigate to **Policy > App content > Data safety**.

Since AutoMate is local-only with no analytics, ads, or accounts:

1. **"Does your app collect or share any of the required user data types?"** — **No**
2. Note: The VIN lookup sends a VIN to the NHTSA API over HTTPS. If prompted about data transmission, disclose this accurately — it's minimal and optional.
3. **"Do you provide a way for users to request data deletion?"** — **Yes** (users delete by uninstalling or clearing app data)
4. Enter your **privacy policy URL**

### 4.5 Other required sections

| Section | Value |
|---------|-------|
| Target audience | 18 and over (never select under 13 unless COPPA-compliant) |
| Ads declaration | No ads |
| App access | All functionality available without special access |
| Contact email | banderberg@gmail.com (public on your listing) |
| Category | Auto & Vehicles |

---

## Part 5: Testing Strategy — Start Small

This is the section that answers "I'm not sure I want to open it up to the world yet."

### The 12/14 Rule (Critical for New Accounts)

New personal developer accounts (registered after Nov 2023) **must** complete closed testing before getting production access:

- Run a closed test with **at least 12 testers** opted in
- Those 12 testers must stay opted in for **14 consecutive days**
- After 14 days, click **"Apply for production"** in Play Console
- Google reviews your application (~7 days)
- Until approved, you cannot publish to production or open testing

### Recommended Path

#### Phase A: Internal Testing (Days 1–3)

Internal testing = up to 100 testers, **no Google review**, instant availability.

1. In Play Console, go to **Testing > Internal testing**
2. Click **"Create new release"**
3. At the App Signing prompt, select **"Use Google-generated key"** (default)
4. Upload your `.aab` file manually (first upload must be manual)
5. Add yourself and 2–3 trusted people by Gmail address
6. They'll get an install link — test thoroughly
7. Upload new builds as needed (no review delay)

**What to test:**
- First launch → onboarding → add vehicle → add events → dashboard
- All event types (fuel, service, expense)
- Reminders with notifications
- Backup/restore cycle
- Import from CSV
- PDF and CSV export
- Dark mode, different screen sizes
- Kill and reopen the app (data persistence)

#### Phase B: Closed Testing (Days 4–18+)

Closed testing = invite-only, **Google review required**.

1. Create a **Closed testing** track in Play Console
2. Add **12+ testers** by email (friends, family, car enthusiast communities, coworkers)
3. Upload your AAB
4. Wait for Google review (**1–7 days** for first review)
5. Once approved, share the opt-in link with your testers
6. **Wait 14 days** with all 12 testers opted in
7. Collect feedback, fix issues, upload new builds
8. After 14 days → click **"Apply for production"** → answer questions → wait ~7 days

**Where to find 12 testers:**
- Friends and family with Android phones
- Car enthusiast forums or subreddits (r/cars, r/personalfinance)
- Expo/React Native developer communities
- Local car clubs or Facebook groups
- Colleagues

#### Phase C: Production with Staged Rollout (Day 25+)

Once production access is granted:

1. Create a **Production release** with **staged rollout at 5–10%**
2. Monitor crashes, ANRs, and reviews for 2–3 days
3. If stable, increase to 25% → 50% → 100%
4. Each increase is manual in Play Console

#### Alternative: Stay in Closed Testing Longer

If you're not ready for production, you can keep the app in closed testing indefinitely. This gives you:
- A real Play Store listing (visible only to invited testers)
- Google Play review and policy compliance
- Real-world testing with real users
- No public visibility until you're ready

You can add more testers over time and only move to production when you're confident.

---

## Part 6: Automating Future Submissions

After your first manual upload, automate with EAS Submit.

### 6.1 Create a Google Service Account

1. Go to https://console.cloud.google.com/projectcreate — create a project
2. Go to **IAM & Admin > Service Accounts > Create Service Account**
3. Name it "EAS Submit", click Done
4. Click on it → **Keys > Add Key > Create new key > JSON** → download
5. Enable the **Google Play Android Developer API** at https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com
6. In Play Console → **Users and permissions > Invite new users**
7. Paste the service account email, grant release permissions for AutoMate
8. Save the JSON file as `google-services.json` in your project root

**Add to `.gitignore`:**
```
google-services.json
```

### 6.2 Submit via CLI

```bash
# Submit a previously built AAB
eas submit --platform android

# Or build + submit in one command
eas build --platform android --profile production --auto-submit
```

To change the target track, update the `"track"` value in `eas.json`:
```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-services.json",
      "track": "production"  // or "internal", "alpha" (closed), "beta" (open)
    }
  }
}
```

---

## Part 7: The Review Process

### What Google reviews
- Privacy policy is live and accessible
- Data safety section matches actual app behavior
- Content rating completed
- App doesn't crash on launch
- Description and screenshots accurately represent the app
- Permissions are justified by functionality
- Target API level is current (Expo handles this)

### Common rejection reasons to avoid
1. **Missing/broken privacy policy URL** — host it before submitting
2. **Incomplete data safety section** — complete every question
3. **App crashes on launch** — test the production AAB on a real device
4. **Description doesn't match functionality** — only claim features that work
5. **VIN lookup disclosure** — mention the NHTSA API data transfer in data safety if prompted

### Review timeline
- Internal testing: **instant** (no review)
- First closed/production review: **1–7 days**
- Subsequent reviews: **hours to 1 day**

---

## Part 8: Post-Launch

### Responding to reviews
- Navigate to **Ratings and reviews** in Play Console
- Reply professionally — a response to a negative review can prompt a rating update
- Install the **Google Play Console mobile app** for notifications

### Monitoring app health
- **Quality > Android vitals** — tracks crashes, ANRs, and memory issues
- Crash rate warning threshold: ~1.09% (above ~8% = reduced search visibility)
- ANR warning threshold: ~0.47%
- The release dashboard prioritizes quality issues for your latest release

### Updating the app
1. Bump version in `app.json` (e.g., `"version": "1.1.0"`)
2. `eas build --platform android --profile production`
3. `eas submit --platform android`
4. Create a new Production release with staged rollout (10–20%)
5. Monitor for 2–3 days, then increase to 100%

---

## Part 9: Costs

| Item | Cost |
|------|------|
| Google Play Developer account | **$25 one-time** |
| EAS Build (free tier) | **$0/month** — 30 builds/month, low-priority queue |
| EAS Submit | **Free** on all tiers |
| EAS Update (OTA hotfixes) | **Free** up to 1,000 monthly active users — **optional, not required** |
| Google Play hosting | **Free** |
| Privacy policy hosting | **Free** (GitHub Pages, Netlify, etc.) |

**Total cost for a solo developer: $25 one-time.**

### Keeping costs at $0/month

- **Skip EAS Update entirely.** Push updates through the Play Store instead of OTA. This avoids the 1,000 MAU limit that would eventually force a $99/month upgrade.
- **Build budget:** 1 build per release = ~4/month if releasing weekly. You won't hit the 30-build limit unless you're in a heavy dev sprint.
- **If you hit the build limit**, either wait for the monthly reset or build locally for free:
  ```bash
  npx expo run:android --variant release
  ```
  This runs the build on your own machine — no EAS needed. You manage the Android SDK and signing yourself, but it works.

### When you'd need to upgrade

The Production tier ($99/month) gives 1,000 builds/month and 50,000 EAS Update MAU. You'd only need this if:
- You're running CI/CD with builds on every commit
- You adopt EAS Update and cross 1,000 active users receiving OTA updates

Neither applies at launch. The free tier should carry you well past your first few thousand Play Store users.

Check https://expo.dev/pricing for current numbers — Expo adjusts tiers periodically.

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Account registration + verification | 2–7 days |
| First build + internal testing | 1–3 days |
| Closed testing (12 testers, 14 days) | 14–18 days |
| Production access application | Up to 7 days |
| Production review | 1–7 days |
| Staged rollout to 100% | 3–7 days |
| **Total (realistic)** | **4–6 weeks** |

The 14-day closed testing requirement is the biggest time gate. Start recruiting your 12 testers early.

---

## Master Checklist

### Preparation
- [x] Host privacy policy at a public URL — https://banderberg.github.io/arctoslabs/privacy.html
- [ ] Create app icon (512x512 PNG, no transparency)
- [ ] Create feature graphic (1024x500)
- [ ] Capture and frame 4–8 phone screenshots
- [x] Build production AAB: `eas build --platform android --profile production`
- [ ] Test preview APK on a real device

### Google Play Setup
- [x] Register developer account ($25)
- [x] Complete identity verification
- [ ] Create the app in Play Console
- [ ] Fill in store listing (name, descriptions, graphics)
- [ ] Complete content rating questionnaire
- [ ] Complete data safety section
- [ ] Set target audience (18+)
- [ ] Declare no ads
- [ ] Set app access (no special access needed)
- [ ] Add privacy policy URL

### Testing & Launch
- [ ] Upload AAB to Internal testing (manual, first time)
- [ ] Opt in to Google Play App Signing
- [ ] Add internal testers, test thoroughly
- [ ] Create Closed testing track, add 12+ testers
- [ ] Wait for Google review (1–7 days)
- [ ] Share opt-in link, wait 14 days with 12 testers
- [ ] Apply for production access
- [ ] Wait for approval (~7 days)
- [ ] Create Production release with 5–10% staged rollout
- [ ] Monitor, increase to 100%

### Automation (While Waiting)
- [ ] Create Google Cloud project + service account
- [ ] Download JSON key → `google-services.json`
- [ ] Enable Google Play Android Developer API
- [ ] Invite service account to Play Console
- [ ] Add `google-services.json` to `.gitignore`
- [ ] Test: `eas submit --platform android`
