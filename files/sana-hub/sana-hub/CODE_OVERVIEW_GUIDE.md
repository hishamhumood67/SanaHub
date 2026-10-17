# SANA HUB: Code Overview Guide

**Where Saudi Makers Build the Future** · صنع في السعودية · هَبْ الهندسة التفاعلية

Read this before pushing to GitHub. It explains what every file does, how the pieces talk to each other, and what is still a stand-in.

---

## 0. Honest status

| Item | Status |
|---|---|
| Syntax | Checked with `tsc`: zero syntax errors. |
| Full type-check and running in a browser | **Not done.** I had no network, so React, three.js and Next types were not installed. Run `npm install && npm run typecheck && npm run dev` first and expect a few small fixes, mostly around R3F v9 / drei v10 typings. |
| 3D realism | Procedural (built from code) with PBR materials and image-based lighting. Optional GLB hook is in place but no GLB files are included. |
| Community backend | **LocalStorage demo** with four seed projects. It is per-browser: nobody else can see what you publish yet. |
| Authentication | Not built. One stub function (`currentAuthor()`) marks where it plugs in. |
| SANA AI | Rule-based (keywords + the circuit evaluator), works offline in both languages. Not a language model yet. |
| Code editor, block editor, simulation | Not part of this drop. |
| Arabic copy | Written by me in a Saudi-friendly tone. Have a native editor proofread it before launch. |

---

## 1. Project tree

```
sana-hub/
├─ CODE_OVERVIEW_GUIDE.md  README.md  .gitignore  .env.example
├─ package.json  tsconfig.json  tailwind.config.ts  postcss.config.mjs  next.config.mjs
├─ public/models/               optional .glb files (git-ignored by default)
└─ src/
   ├─ app/
   │  ├─ layout.tsx             fonts, <html lang dir>, boot script, LanguageProvider
   │  ├─ globals.css
   │  └─ playground/page.tsx    the screen: tabs, layout picker, canvas, SANA AI, share dialog
   ├─ i18n/
   │  ├─ dictionaries.ts        every UI string, English + Arabic
   │  └─ LanguageContext.tsx    language state, dir switching, persistence
   ├─ components/LanguageSwitcher.tsx
   ├─ 3d-components/
   │  ├─ SanaCanvas3D.tsx       the 3D scene + on-screen HUD
   │  ├─ WireManager.tsx        wire curves, drag-to-connect, snap targets
   │  ├─ layouts.ts             where every part and pin sits (pure data)
   │  └─ parts/
   │     ├─ BreadboardModel.tsx  Esp32Model.tsx  HcSr04Model.tsx
   │     ├─ MindstormsModels.tsx  EV3 brick, motor, ultrasonic, color sensor, work mat
   │     ├─ PartLoader.tsx       GLB-or-procedural switch
   │     └─ labelTexture.ts      draws silkscreen text into textures
   ├─ simulators/
   │  ├─ pinCatalog.ts          every pin: kind, GPIO number, notes (EN/AR)
   │  └─ circuitEvaluator.ts    the wiring checker (ESP32 + Mindstorms)
   ├─ templates/
   │  ├─ types.ts  index.ts     template shape + registry
   │  ├─ hcsr04-distance.ts     ESP32 + HC-SR04 lesson, starter C++ code
   │  └─ mindstorms-explorer.ts EV3 lesson, starter pybricks Python code
   ├─ ai-tutor/
   │  ├─ SanaAiDiagnosticPanel.tsx   review tab + chat tab
   │  └─ tutorBrain.ts               bilingual answer engine
   └─ community/
      ├─ projectSchema.ts       circuit JSON format + validator
      ├─ communityStore.ts      repository interface + LocalStorage implementation
      ├─ ShareDialog.tsx        "Share to Community Hub"
      └─ CommunityHubGallery.tsx   explorer: like, star, remix
```

## 2. How data flows

```
                       page.tsx  (owns: layoutId, wires[], echoDivider, highlight)
                          │
      ┌───────────────────┼─────────────────────────────┐
      ▼                   ▼                             ▼
 SanaCanvas3D       evaluateCircuit()            ShareDialog / Gallery
 draws wires,   ──▶  wires → result  ──▶ rings    serializeCircuit() ⇄ parseCircuit()
 emits changes       (issues, steps)     on pins   communityStore (LocalStorage → Supabase)
      ▲                   │
      │                   ▼
      └──── highlight ── SanaAiDiagnosticPanel (review tab + chat via tutorBrain)
```

The page holds the **single source of truth** (`wires`). The canvas edits it, the evaluator reads it, SANA AI explains the evaluator's result, and the community layer saves or loads it as JSON.

---

## 3. File by file

| File | What it does | Depends on |
|---|---|---|
| `app/layout.tsx` | Loads IBM Plex Sans Arabic (covers Latin and Arabic) and Plex Mono, injects the language boot script, wraps the app in `LanguageProvider`. | `LanguageContext` |
| `app/playground/page.tsx` | The only screen. Two tabs (Playground / Community), project picker (ESP32 or Mindstorms), Share button, remix handling, toast. | everything below |
| `i18n/dictionaries.ts` | All UI strings as `en` and `ar` objects. TypeScript forces both languages to have the same keys. Curriculum text is **not** here. | none |
| `i18n/LanguageContext.tsx` | See section 4. | `dictionaries` |
| `components/LanguageSwitcher.tsx` | The "EN \| عربي" toggle. | `LanguageContext` |
| `3d-components/SanaCanvas3D.tsx` | See section 5. | layouts, WireManager, parts, pinCatalog |
| `3d-components/WireManager.tsx` | See section 6. | layouts, pinCatalog |
| `3d-components/layouts.ts` | One place for every position, camera, pad size and wire style. No three.js import, so the validator can use it safely. | pinCatalog |
| `3d-components/parts/*` | Procedural models. Pin pads are **not** part of the models (they live in `SanaCanvas3D`), so a GLB can replace a model without breaking wiring. | layouts |
| `simulators/pinCatalog.ts` | Data for every pin on every part: name, GPIO, kind, voltage note, EN/AR explanation. | none |
| `simulators/circuitEvaluator.ts` | Section 8. | pinCatalog |
| `templates/*` | Lesson content: steps, starter code, line-by-line explanations, all `{ en, ar }`. One template per layout. | types |
| `ai-tutor/tutorBrain.ts` | Matches keywords (Arabic is normalised: diacritics, alef and ya variants) and builds answers. Replies are stored as `{ en, ar }`, so switching language re-renders old messages. | evaluator result, template |
| `ai-tutor/SanaAiDiagnosticPanel.tsx` | Score ring, wiring steps, issue cards with "show on board", divider checkbox (ESP32 only), chat. Accepts an optional `askRemote` function to plug in a real model. | tutorBrain |
| `community/projectSchema.ts` | Section 7. | layouts, pinCatalog |
| `community/communityStore.ts` | `CommunityRepository` interface + LocalStorage implementation + seeds. | projectSchema |
| `community/ShareDialog.tsx` | Native `<dialog>` form: snapshot, title, description, up to 5 tags. | communityStore |
| `community/CommunityHubGallery.tsx` | Search, tag filter, sort, cards with Like / Star / Remix. Optimistic-free: it re-renders from what the repository returns. | communityStore |

---

## 4. `LanguageContext.tsx`: language switching and RTL/LTR mirroring

**State.** `lang` is `'en' | 'ar'`. `dir` is derived (`ltr` / `rtl`), never stored separately, so they cannot disagree.

**On first load** the provider reads `localStorage['sanahub.lang']`. If nothing is stored it uses the browser language (`ar*` becomes Arabic).

**Every change of `lang`** runs an effect that sets `document.documentElement.lang` and `.dir`, and saves to LocalStorage. A `storage` listener keeps other open tabs in sync.

**No wrong-direction flash.** `langBootScript` is a tiny inline script in `<head>` that sets `lang` and `dir` *before* the first paint. React then takes over. (Because the server renders English first, an Arabic user can briefly see English text before hydration. If that bothers you later, store the language in a cookie and read it on the server.)

**Strings.** `t('key', { n: 3 })` looks up a UI string and replaces `{n}`. `pick({ en, ar })` chooses from curriculum objects. That is the separation you asked for: UI strings in `dictionaries.ts`, technical content next to the feature that owns it.

**How the layout mirrors.** Nothing is "flipped" by JavaScript. The browser does it, because the CSS uses *logical* properties instead of left/right:

- Tailwind `start-3`, `end-3`, `ms-auto`, `ps-9`, `text-start`, `border-s-4` follow `dir`.
- `grid` and `flex` rows reverse automatically (the tutor panel moves to the other side in Arabic).
- Direction-sensitive icons use `rtl:-scale-x-100` (the send arrow).
- Things that must stay left-to-right are wrapped in `dir="ltr"`: the language switcher, code blocks, pin names and voltage strings.

**Two traps handled.** (1) Content inside `<Canvas>` lives in a separate React root and cannot read the language context, so `SanaCanvas3D` resolves translated strings first and passes plain strings in. (2) `Intl` with `ar-SA` uses the Hijri calendar by default, so dates use `ar-SA-u-ca-gregory`.

---

## 5. `SanaCanvas3D.tsx`: the 3D scene

**Structure.** The exported component is a normal DOM component. It owns UI state (hover, selected pin), the HUD (pin inspector, toolbar, tooltip) and a `<Canvas>`. Inside the canvas, `Scene` holds the actual 3D world.

**Layouts.** `layoutId` picks a `LayoutDef` (`esp32-hcsr04` or `mindstorms`). The `<Canvas key={layoutId}>` is re-created on switch so the camera and controls reset cleanly.

**Studio lighting** (all in `Scene`):
- `<Environment preset="city">` gives reflections. Metal shields, gold pins and clear-coated plastic look real because they reflect this image. **Note:** drei downloads that HDR from a CDN at runtime. It is wrapped in `Suspense`, so the scene still renders without it (just flatter). For production, host a `.hdr` file in `public/` and pass `files="/hdr/city.hdr"`.
- One shadow-casting `directionalLight` (2048 map) plus a faint `hemisphereLight`.
- `<ContactShadows>` darkens the area directly under the board or robot so it sits on the surface.
- ACES filmic tone mapping (the R3F default).

**Materials.** `MeshPhysicalMaterial` with `clearcoat` for PCB solder mask, breadboard plastic and EV3 plastic; `MeshStandardMaterial` with `metalness: 1` for shields, pins and USB. Silkscreen text, pin labels, breadboard numbers and the EV3 screen are drawn into canvas textures by `labelTexture.ts`: no image files or font downloads, and it works offline.

**Procedural vs GLTF.** Every model is wrapped in `PartModel`. If you set a URL in `MODEL_URLS` (for example `esp32: '/models/esp32-devkit.glb'`), it loads that GLB with `useGLTF`. While loading, or if the file is missing or broken, an error boundary falls back to the procedural model. Pins and wires do not depend on the model, so you can swap art without touching logic. Only add GLBs whose licence allows redistribution.

**Pins.** `PinMesh` draws a metal pad (gold on breadboard parts, grey sockets on Mindstorms) plus an **invisible, larger sphere** for easy clicking and touch. A red or amber torus ring appears when the evaluator flags the pin; a pulse appears when SANA AI says "show on board".

**Snapshot.** The canvas uses `preserveDrawingBuffer: true`. `Scene` registers a capture function that renders one frame, downsizes it to 640 px and returns a JPEG data URL. The page calls it through the component's ref (`canvasRef.current.snapshot()`), which is how the Share dialog gets its thumbnail. (`preserveDrawingBuffer` costs a little performance; it is the simplest reliable way to take a screenshot.)

---

## 6. `WireManager.tsx`: curve math and snap targets

### The curve

`buildWireCurve(A, B, exitA, exitB, style, settle)` returns a `THREE.CatmullRomCurve3`, a smooth spline that passes **through** every control point. (A Bezier curve is only *pulled toward* its control points; passing through them makes placement predictable, which is why `CatmullRomCurve3` is the right tool here.)

1. **Leave the pin first.** `A' = A + exitA · e` and `B' = B + exitB · e`. Breadboard and sensor pins exit upward; EV3 ports exit straight toward the camera. `e` is `style.exit`.
2. **Take three points on the chord** `A'→B'` at `t = 0.25, 0.5, 0.75`.
3. **Push them with a parabola.** `y += L · k · (1 + s) · 4t(1 − t)`, where `L = |A'B'|`, `k = style.amount`, and `4t(1−t)` is 0 at the ends and 1 in the middle.
   - `mode: 'arch'` (jumper wire): offset is **up**.
   - `mode: 'droop'` (EV3 cable): offset is **down**, so it hangs.
   - Every point is clamped to `y ≥ 0.12` so a cable rests on the mat and never goes through it.
4. **Spline:** `new CatmullRomCurve3([A, A', m25, m50, m75, B', B], false, 'catmullrom', 0.5)`.
5. **Mesh:** `TubeGeometry(curve, 48, radius, 8)`, plus a small plug cap at each end.

### The bounce when you place a wire

`s(t) = 0.9 · e^(−4.2·t) · cos(13·t)` is a damped spring. At `t = 0` the wire is 1.9× its resting arch, it overshoots and settles over 1.4 s. During that time `useFrame` rebuilds the tube geometry each frame and disposes the old one; afterwards it stops, so idle wires cost nothing. Loading a remix makes all its wires bounce into place.

### Drag, snap, connect (`useWireDrag`)

1. **Press** on a pin (`begin`): remember the pin, disable `OrbitControls` so the camera does not orbit.
2. **Every frame:** project each pin into screen space and take the nearest within `SNAP_PX = 34` pixels of the pointer. Screen space is used (not 3D distance) because that matches what the eye sees from any camera angle, including the vertical Mindstorms panel.
3. **Preview:** the free end is where the pointer ray hits a plane that faces the camera and passes through the source pin; if a pin is snapped, the end locks onto it. The preview line uses the **same** curve function, so what you see while dragging is what you get.
4. **Release** (a `window` listener, so it works even outside the canvas): connect if snapped; if the pointer barely moved (< 6 px) treat it as a click and select the pin; otherwise cancel. Refs mirror the state so this listener never reads stale values.

### Glowing snap targets

While dragging, every other pin shows a dim ring; the snapped pin shows a bright pulsing ring with a halo and a small green point light. They are `Billboard` rings (always facing the camera) with additive blending, `toneMapped: false` and `depthTest: false`, so they glow and stay visible through parts. If you later want a true bloom effect, add `@react-three/postprocessing`.

---

## 7. Saving, sharing and remixing: circuits as JSON

### The document (`projectSchema.ts`)

```json
{
  "schema": "sana-hub/circuit",
  "version": 1,
  "layout": "esp32-hcsr04",
  "wires": [
    { "a": "hcsr04:GND",  "b": "esp32:GND1" },
    { "a": "hcsr04:VCC",  "b": "esp32:VIN"  },
    { "a": "hcsr04:TRIG", "b": "esp32:D18"  },
    { "a": "hcsr04:ECHO", "b": "esp32:D19"  }
  ],
  "options": { "echoDivider": true }
}
```

It stores **only what defines the circuit**: which layout, which pin connects to which, and the divider checkbox. It does not store 3D positions (those come from `layouts.ts`), wire ids (regenerated on load), the camera, or the screenshot. That keeps files tiny (a few hundred bytes), makes them robust when models change, and means the `version` field is enough to migrate old documents later.

### The flow

- **Publish:** `wires` in page state → `serializeCircuit()` → `repo.publish()`, which **re-validates** with `parseCircuit()`, sanitises text (control characters removed, lengths capped: title 80, description 600, 5 tags of up to 24 characters), stores the project, and if `remixOf` is set increments the original's remix count.
- **Remix:** gallery card → `parseCircuit()` again (never trust stored JSON) → `documentToWires()` gives fresh ids → page switches layout, loads wires and the divider flag, remembers `remixOf`, and opens the Playground. When the user later shares, the original is credited.
- **Why validate twice?** Documents come from other users. `parseCircuit` rejects unknown schema/version/layout, more than 64 wires, unknown pins, pins from parts not in that layout, self-loops, and drops duplicates. It rebuilds a clean object instead of trusting the input.

### Moving to Supabase (when you are ready)

`communityStore.ts` exposes `CommunityRepository` with `list`, `publish`, `toggleLike`, `toggleStar`. Write a `SupabaseRepository` with the same methods and return it from `getCommunityRepository()`. No component changes.

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text not null default '' check (char_length(description) <= 600),
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  layout text not null check (layout in ('esp32-hcsr04','mindstorms')),
  circuit jsonb not null check (pg_column_size(circuit) < 20000),
  thumbnail_path text,                                   -- Supabase Storage, not base64
  remix_of uuid references projects(id) on delete set null,
  created_at timestamptz not null default now()
);

create table project_likes (
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (project_id, user_id)
);
create table project_stars (like project_likes including all);

alter table profiles       enable row level security;
alter table projects       enable row level security;
alter table project_likes  enable row level security;
alter table project_stars  enable row level security;

create policy "read projects"  on projects for select using (true);
create policy "insert own"     on projects for insert with check (author_id = auth.uid());
create policy "update own"     on projects for update using (author_id = auth.uid());
create policy "delete own"     on projects for delete using (author_id = auth.uid());
create policy "read likes"     on project_likes for select using (true);
create policy "like as me"     on project_likes for insert with check (user_id = auth.uid());
create policy "unlike as me"   on project_likes for delete using (user_id = auth.uid());
-- same three policies for project_stars; profiles: read all, update own
```

Notes: the remix count is simply `count(*) from projects where remix_of = id` (a view or RPC), so it counts *published* remixes. Validate the circuit JSON again server-side (a Postgres function or an API route) because a client can bypass your UI. Add rate limits and a report/moderation path before opening publishing to the public.

### Authentication

Use Supabase Auth with `@supabase/ssr`: sign-in page, session in cookies, then replace `currentAuthor()` with the session user. Gate Publish, Like and Star behind login; Browsing and Remix-to-playground can stay public. NextAuth works too, but with Supabase you get row-level security tied to `auth.uid()` for free.

---

## 8. The circuit evaluator (`circuitEvaluator.ts`)

Wires merge pins into **nets** (union-find), so a chain of wires counts as one connection. Rules run on nets.

**ESP32 + HC-SR04**

| Rule | Severity |
|---|---|
| Any power pin joined to GND (short circuit) | Error |
| VIN (5 V) tied to 3V3 | Error |
| **VIN (5 V) wired to an ESP32 GPIO (voltage mismatch)** | Error |
| Two ESP32 GPIOs tied together | Warning |
| A GPIO wired straight to a rail or GND | Warning |
| Sensor GND not on an ESP32 GND | Error |
| VCC on 3V3 (module needs 5 V) | Warning |
| VCC on a GPIO or anything but VIN | Error |
| TRIG and ECHO tied together | Error |
| TRIG or ECHO on a rail / not on a GPIO | Error |
| TRIG on an input-only pin (34, 35, 36, 39) | Error |
| TRIG or ECHO on a UART0 or boot-strapping pin | Warning |
| **ECHO (5 V pulse) into a 3.3 V GPIO without a divider** | Warning |

**Mindstorms:** motor not on an EV3 port, motor on an input port, sensor on an output port, two devices sharing one port, port-to-port wires (all errors).

**Known simplification:** there is no resistor part in 3D yet, so the 1 kΩ / 2 kΩ divider is a checkbox in the panel. Adding a resistor part is the natural next step and will make the ECHO rule fully automatic.

---

## 9. Putting it on GitHub

```bash
cd maker-hub                      # you may rename the folder to sana-hub
npm install
npm run typecheck                 # fix anything it reports
npm run dev                       # open http://localhost:3000/playground

git init
git add .
git commit -m "SANA HUB: 3D playground, SANA AI, community prep"
git branch -M main
git remote add origin git@github.com:<your-user>/sana-hub.git
git push -u origin main
```

Checklist before the first push:

- [ ] Typecheck passes and the page opens.
- [ ] Add a `LICENSE` (MIT, Apache-2.0, or "all rights reserved"; decide on purpose).
- [ ] `.env.local` is git-ignored (it is). Never commit keys; `ANTHROPIC_API_KEY` must only be used in server code.
- [ ] Only commit 3D models you have the right to redistribute (`public/models/*.glb` is ignored by default).
- [ ] Optional CI: `.github/workflows/ci.yml` running `npm ci && npm run typecheck && npm run build` on pull requests.

## 10. Known gaps before a public launch

- **Keyboard and screen-reader wiring:** wiring is mouse/touch only. Add an accessible "connect pin A to pin B" form.
- **Environment lighting** needs internet unless you self-host the HDR (section 5).
- **Community is per-browser** until the Supabase repository exists. Thumbnails in LocalStorage are large; the store drops them if the quota is exceeded.
- **Mindstorms layout is simplified:** both port rows face the viewer (the real brick splits them across two faces).
- **SANA AI** is keyword-based. For real conversation, add an API route (for example `/api/sana-ai`) that calls a model with a Saudi mechatronics-tutor system prompt and the current evaluator result, then pass it as `askRemote`.
- **Next features from your original plan** not yet built: Monaco code editor, block editor and block-to-C++ conversion, serial monitor and simulation, dashboard, quizzes, certificates.
