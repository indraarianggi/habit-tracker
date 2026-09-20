# Research: Reliable browser timers

Ticket: [04-reliable-browser-timers](../issues/04-reliable-browser-timers.md)
Researched: 2026-09-19. Sources are MDN, browser vendor docs, WHATWG/W3C specs and MDN browser-compat-data (BCD). Each claim is marked **Verified** (stated in the cited source) or **Uncertain** (not confirmed by a primary source, or only inferred). Nothing here recommends a stack.

## 1. How `setTimeout` / `setInterval` are throttled in background tabs

### The spec gives browsers permission to delay timers

- **Verified.** The HTML Standard's timer steps say: "Optionally, wait a further implementation-defined length of time. This is intended to allow user agents to pad timeouts as needed to optimize the power usage of the device." It also says the API "does not guarantee that timers will run exactly on schedule." A timer is a minimum delay, not a promise. ([HTML Standard, timers](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html))
- **Verified.** Nested timers (5 or more levels) are clamped to at least 4 ms. ([MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))

### Chrome (desktop and Android)

- **Verified.** Hidden pages get throttling: timers are checked once per second. ([Chrome for Developers, Chrome 88 timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88))
- **Verified.** Intensive throttling (Chrome 88+) checks timers once per minute. It applies only when all of these are true: the page has been hidden for more than 5 minutes, the timer chain count is 5 or more, the page has been silent for at least 30 seconds, and WebRTC is not in use. A `setInterval` counts as a chain, so a 1-second countdown tick qualifies. ([same source](https://developer.chrome.com/blog/timer-throttling-in-chrome-88); [MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))
- **Verified.** Exemptions: the page is visible, audio played in the last 30 seconds, chain count below 5, hidden for less than 5 minutes, or WebRTC is in use. A silent audio track does not count as audio. ([Chrome 88 post](https://developer.chrome.com/blog/timer-throttling-in-chrome-88))
- **Verified.** Chrome's design note says wake-ups are throttled "independently per Window". The scope is Window timers, and the note does not mention workers. ([blink-dev, Intent to Implement and Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/8En_5DqV_fU/m/I8e9vaecAgAJ))
- **Verified.** Chrome may also freeze hidden pages, and frozen pages run no timers. The docs list heuristics that avoid freezing: audio playing, WebRTC, updating title or favicon, alerts, push notifications. ([Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api))
- **Verified.** On mobile, "users can terminate apps without triggering expected lifecycle events." Discarded pages run no code. ([Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api))

### Firefox

- **Verified.** Desktop: inactive tabs have a 1 second minimum timeout. There is no throttling if the tab holds an `AudioContext`. ([MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))
- **Verified.** Firefox for Android: a minimum timeout of 15 minutes for inactive tabs, and the tab may be unloaded entirely. ([MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))
- **Verified.** Recognised tracking scripts get an extra 10 second minimum in background tabs. ([MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))

### Safari (macOS and iOS)

- **Verified.** WebKit's power-usage guidance says that for inactive pages "Timers are throttled", `requestAnimationFrame` stops, and on macOS inactive tabs are subject to App Nap. ([WebKit blog, How Web Content Can Affect Power Usage](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/))
- **Uncertain.** No primary WebKit or Apple source found gives Safari's numeric throttle intervals for hidden tabs, or states what happens to JavaScript when an iOS device is locked. The only material found is Apple Developer Forum posts. Some are unanswered, and none are authoritative. They report that Safari pauses timers when minimised and that iOS suspends backgrounded processes. Treat iOS lock-screen behaviour as "timers can stop entirely" until tested on a device.

### Page Visibility and back/forward cache

- **Verified.** `visibilityState` is `hidden` when the tab is in the background, the window is minimised, or the screen is off. `visibilitychange` fires on transitions. ([MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API))
- **Verified.** Pages in the back/forward cache have their pending timers paused. `pagehide` and `pageshow` (with `persisted`) mark the transitions. ([web.dev bfcache](https://web.dev/articles/bfcache))

## 2. Timestamp-based timing, and what a Web Worker adds

### Timestamp-based timing

- **Verified.** Because timers are only "at least this long" (see the HTML Standard quote above), a tick count cannot be trusted. Computing remaining time from a stored target time on each tick removes the drift, and throttling then only delays how often the display refreshes. This follows from the spec statements above, not from a source that recommends the pattern.
- **Verified.** `Date.now()` is wall-clock time and follows system clock adjustments. `performance.now()` is monotonic, but per MDN it "does not tick during sleep" in Chrome, Firefox and Safari (only browsers on Windows keep ticking), although the spec says it should. ([MDN Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now))
  - Consequence: a countdown based on `performance.now()` will under-count if the device sleeps. A wall-clock timestamp (`Date.now()`) keeps counting across sleep, at the cost of being affected by user clock changes.
- **Uncertain.** Whether a user changing the system clock mid-session needs handling is a product decision, and no source addresses it.

### What a Web Worker adds

- **Verified.** Dedicated workers can use `setTimeout` and `setInterval`. ([MDN, functions available to workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Functions_and_classes_available_to_workers)) They cannot touch the DOM and communicate by `postMessage`. ([MDN Using web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers))
- **Verified.** Chrome's intensive throttling design is scoped to Window timers (see above). It does not say workers are exempt or covered. Chrome's separate 1-second alignment for hidden pages is also documented only for page timers.
- **Uncertain.** No primary source found states that worker timers are unthrottled in Chrome, Firefox or Safari. Anecdotal mentions exist in search results only. Worker timer behaviour in background tabs and on iOS needs a device test if the decision depends on it.
- **Verified.** A worker does not outlive the page. Dedicated workers stop when the page closes. Shared workers stop when no window, iframe or worker references them, unless `extendedLifetime` is set. ([MDN Using web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)) A worker therefore cannot keep a timer alive after the tab is closed.
- **Verified.** Frozen or discarded pages run no code, and workers belong to the page. A worker does not protect against freezing, discarding, or OS suspension of the whole process.

## 3. Alerting the user when a session ends

### Notification API

- **Verified.** Requires a secure context (HTTPS) and explicit user permission. Permission should be requested in response to a user gesture, and Firefox and Safari enforce that. Values are `granted`, `denied`, `default` (`default` behaves as denied). ([MDN requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static); [MDN Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API))
- **Verified.** Notifications show at the system level, so they can reach a user whose app is idle or in the background. ([MDN Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API))
- **Verified.** The `Notification()` constructor is not usable on most mobile browsers. Chrome Android, Opera Android and Samsung Internet require `ServiceWorkerRegistration.showNotification()`. ([MDN BCD api.Notification](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json); [MDN Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)) `showNotification()` is called on the registration and supports `tag`, `requireInteraction` and `silent`. ([MDN showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification))
- **Verified.** Chrome does not show notifications in incognito. Android WebView does not support the API. ([BCD api.Notification](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json))
- **iOS Safari, verified.** Since iOS/iPadOS 16.4, Web Push works only for web apps added to the Home Screen, with a manifest `display` of `standalone` or `fullscreen`. Permission must be requested from a direct user interaction. ([WebKit blog, Web Push for Web Apps on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)) BCD agrees: on iOS the `Notification` interface is undefined unless the page is a Home Screen web app, and notifications must go through a service worker. ([BCD api.Notification](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)) A plain Safari tab on iOS cannot show notifications.
- **Notification only helps if code runs at the right time.** A notification triggered by page JavaScript needs the page to be running. Two ways to alert with the page not running:
  - **Push API, verified.** A push server sends a message to a service worker, which shows the notification even if the app is closed. It needs a service worker, user permission and a push server. ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)) On iOS, Web Push is Home Screen only (above).
  - **Notification Triggers (scheduled local notifications), verified dead.** Chrome's own docs say development "has ended" because it wasn't clear consistent, reliable experiences could be provided across platforms. It was Chrome-only and origin trial only. ([Chrome for Developers](https://developer.chrome.com/docs/web-platform/notification-triggers)) It cannot be relied on.

### Web Audio API (and audio generally)

- **Verified.** Autoplay policy: audio started outside a user gesture is blocked until the user has interacted with the site. An `AudioContext` created before a gesture is `suspended` and must be `resume()`d from inside a user gesture. ([MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices); [MDN Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay); [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay))
  - Consequence: the context must be unlocked by a user gesture, for example the Start button, before the session ends.
- **Verified.** Chrome gives autoplay privileges to sites installed as a PWA or added to the mobile home screen. ([Chrome autoplay policy](https://developer.chrome.com/blog/autoplay))
- **Verified.** Audio also affects throttling. Chrome exempts a page from intensive throttling if it played audio in the last 30 seconds, but silent audio does not count. Firefox does not throttle tabs holding an `AudioContext`. ([Chrome 88 post](https://developer.chrome.com/blog/timer-throttling-in-chrome-88); [MDN setTimeout](https://developer.mozilla.org/en-US/docs/Web/API/setTimeout))
- **Uncertain.** iOS Safari specifics (hardware mute switch, whether audio keeps the page running with the screen locked, WebKit's own autoplay wording) were not confirmed from a primary source. The WebKit video-policy post fetched did not cover Web Audio. Test on a device.
- **Uncertain.** Whether looping near-silent or inaudible audio to keep a tab active is honoured is not supported by any source found. Chrome's docs explicitly say a silent track does not count.

### Screen Wake Lock API

- **Verified.** Requires a secure context. No user-activation requirement in the spec. Controlled by the `screen-wake-lock` Permissions Policy. ([MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API); [W3C Screen Wake Lock spec](https://w3c.github.io/screen-wake-lock/))
- **Verified.** It only prevents the screen dimming or locking while the page is visible. Locks are released automatically when the document becomes hidden, and `request()` rejects with `NotAllowedError` when the page is hidden. The page must call `request()` again on `visibilitychange`. The browser may deny it (for example low battery or power-save mode). A `release` event fires on the sentinel. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API); [W3C spec](https://w3c.github.io/screen-wake-lock/))
  - Consequence: a wake lock helps only a user who leaves the app in the foreground. It does not keep a timer running after the user locks the screen or switches tabs, so it is not a background-timer solution.
- **Verified.** Support (BCD): Chrome 84, Firefox 126, Safari 16.4, Baseline since March 2025. On iOS Safari the API is partial from 16.4 to 18.3 (does not work in standalone Home Screen web apps, WebKit bug 254545) and full from iOS 18.4. ([BCD api.WakeLock](https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json))

## 4. Tab closed or browser restarted, and what to persist

- **Verified.** A closed tab stops all page JavaScript and workers (see section 2), and a discarded or frozen page runs nothing. Timers do not survive. Neither the countdown nor the end-of-session alert can fire from page code while the tab is closed. The only mechanism found that can alert with the page closed is server-sent Web Push (section 3); scheduled local notifications are dead.
- **Verified (implication of the above).** Recovery has to work from persisted data on the next load, not from a running timer. Restoring after a background freeze is also needed, since Chrome can freeze or discard hidden pages. Use `visibilitychange` and `pageshow` to recompute (sections 1 and 2).
- **State needed to recover.** This is a derivation, not a source claim.
  - Session identity: which Habit the Pomodoro Session runs against, and a session id.
  - Session phase and planned duration.
  - Wall-clock start timestamp (or target end timestamp). If pausing is allowed, also the paused-at time and total paused duration.
  - Status: running, paused, completed or abandoned. This is needed so a restored session that has already passed its end time can be turned into a Check-in (or discarded) exactly once.
  - Whether the end-of-session alert was already delivered.
  - Any notification or push subscription record, if used.
- **Verified.** Browser storage is best-effort by default: it persists unless quota is hit, the device is low on space, or the user clears it. `navigator.storage.persist()` lets an origin opt in so data is only evicted by the user. ([MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))
- **Verified.** Safari's Intelligent Tracking Prevention deletes script-writable storage (localStorage, IndexedDB, sessionStorage, service worker registrations) after 7 days of browser use without user interaction. Home Screen web apps are exempt. ([WebKit, Tracking Prevention](https://webkit.org/tracking-prevention/); [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)) This mostly matters for stored Check-ins and Habits (the Storage and accounts ticket), but it also means an unfinished session record is not durable in Safari tabs.
- **Verified.** On eviction, all of an origin's data is deleted together. ([MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria))
- **Uncertain.** Whether a running timer should count time while the tab was closed (a session "completed while away") or be discarded is a product decision, not something the sources settle.

## Facts the decision depends on

1. **Timers are not exact.** The HTML Standard lets browsers delay timers for power reasons and promises no accuracy. Verified.
2. **Hidden tabs get 1-second alignment; Chrome cuts to once per minute after 5 minutes hidden** (chain count 5 or more, silent 30 seconds, no WebRTC). Firefox desktop is 1 second, Firefox Android 15 minutes, Safari "throttled" with no published interval. Verified except Safari's numbers.
3. **A stored timestamp plus recomputing on each tick and on `visibilitychange`/`pageshow` fixes drift, but nothing in page code runs when the tab is frozen, discarded, closed or the OS suspends it.** Verified for freeze, discard and bfcache; iOS lock-screen behaviour Uncertain.
4. **`performance.now()` does not tick during sleep in Chrome, Firefox or Safari.** A wall-clock timestamp does. Verified.
5. **Web Workers add no documented protection.** Chrome's intensive throttling is scoped to Window timers, which suggests workers are treated differently, but no primary source confirms it for any browser. Uncertain; workers die with the page. Verified.
6. **Audio can stop throttling in Chrome (audible in last 30 seconds; silent audio does not count) and Firefox (`AudioContext`).** It must be unlocked by a user gesture. iOS behaviour Uncertain.
7. **Notifications need HTTPS and a user-gesture permission prompt.** Mobile needs a service worker (`showNotification`). iOS needs iOS 16.4+ and a Home Screen install. A plain iOS Safari tab cannot notify. Verified.
8. **Alerting with the page closed needs server-sent Web Push.** Scheduled local notifications (Notification Triggers) are discontinued. Verified.
9. **Screen Wake Lock only keeps the screen on while the page is visible.** It is released on hidden and must be re-requested. It is not a background solution. Verified. iOS support is full from 18.4; partial before that. Verified.
10. **Persist at least: Habit, session id, planned duration, wall-clock start or end time, pause data, status, alert-delivered flag.** Storage is best-effort; Safari tabs lose script-writable data after 7 idle days. Home Screen apps are exempt. Verified (state list is a derivation).

## Open items needing a device test (not answerable from primary sources)

- Safari on iOS: timer behaviour when the screen locks, when the tab is backgrounded, and whether playing audio keeps it alive.
- Whether worker timers avoid throttling in Chrome, Firefox and Safari.
- Web Audio behaviour on iOS with the mute switch on.
