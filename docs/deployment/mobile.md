# TEN. Mobile deployment

TEN. uses Capacitor 8 to package the existing TanStack Start application for
Android and iOS. The web deployment remains SSR-capable; mobile builds use
TanStack Start's SPA mode and generate `dist/client/index.html`.

## Application identity

- Name: `TEN.`
- Bundle/application ID: `com.ten.game`

Change the application ID before the first store submission if a permanent
reverse-domain identifier is available. Changing it after publishing creates a
different application in the stores.

## Local workflow

```sh
pnpm build:mobile
pnpm mobile:sync
pnpm mobile:open:android
pnpm mobile:open:ios
```

`pnpm mobile:sync` creates the mobile SPA, copies it to both native projects,
and synchronizes Capacitor plugins. Android Studio is required for Android
device builds. Xcode on macOS is required for iOS device builds.

## Continuous integration

- `CI`: formatting, lint, types, web build, and mobile web bundle
- `Android`: a debug APK for pull requests and pushes to `main`
- `iOS`: an unsigned Simulator app for version tags and manual runs

Build artifacts are retained in GitHub Actions for 14 days.

## Store signing

The current workflows intentionally produce unsigned development artifacts.
For Google Play, add an upload keystore using GitHub environment secrets and
build an Android App Bundle (`bundleRelease`). For App Store Connect, add an
Apple distribution certificate, provisioning profile, and team ID, then create
an Xcode archive on a protected GitHub environment.

Recommended GitHub environments:

- `android-release`
- `ios-release`

Require manual approval for both environments and keep signing credentials in
environment secrets, never in the repository.
