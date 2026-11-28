# The Middle of the 100 Days — story plan

> **Spoiler file, for Dad and Claude only.** Caspar agreed not to look in the game's files for what
> gets built (IMPROVEMENTS.md, item 6). Nothing in the game or in his doc should repeat what's here.

**Status:** plan only. Written 27 Nov 2026 from Caspar's picks. Reviewed against the code and
rewritten 28 Nov 2026. Nothing is built yet.

**Source:** the "Caspar's Choices: the Middle of the 100 Days" doc
(https://claude.ai/artifact/UPmtvBou4phM6K5coQR7fh), filled in by Caspar. The `.docx` copy in this
folder is an older, blank export.

---

## 1. Caspar's picks

Each option was marked **Yes please**, **Maybe** or **No thanks**.

| Choice | Yes please | Maybe | No thanks |
|---|---|---|---|
| 1. What the middle days feel like | **A growing storm** | A mystery · Visitors · Surprise me | A big build |
| 2. How the story reaches you | *(none)* | Things you find · People you meet | Messages arrive · Just you and the island |
| 3. How the danger changes | **Calm, then big nights** | A bit harder each week · One last big challenge | About the same |
| 4. How often surprises happen | **A mix of both** | Rare but big · Often but small | Hardly ever |
| 5. How much help finding new stuff | **Hints only** | Show me the way | Let me find it |

**His own words:**
- **An idea of his own for the middle days:** left blank.
- **Something he never wants to happen:** left blank.
- **Favourite thing so far:** "scout", meaning **Scout the dog**.
- **A row he added himself,** "fixes and improvements": "able to change things in your hot bar".

**What the picks add up to:**
- An island that gets **wilder toward Day 100**, and no building project.
- **Quiet days broken by big nights you can prepare for.** Small surprises often, and a big one now
  and then.
- A story you **find, and hear from people,** not one that's sent to you by radio.
- **Hints, not markers.**
- **Scout at the centre.**

---

## 2. What the game already has (checked 28 Nov 2026)

**The story so far.**
- The quest chain (`src/story/quests.js`) runs: beach, camp, **befriend Scout**, Radio Tower, three
  parts (one from each boss), **free Ray**, then talk to Ray at the tower.
- **Ray then offers a choice** (`src/story/ray.js`): call the helicopter, which **ends the game**,
  or stay until Day 100. If you stay, **Ray moves to your camp** and makes you breakfast every
  morning.
- **After "stay" there's nothing left to do** but "Survive until Day 100". **That empty stretch is
  the middle days.** Players reach it on different days, and Caspar may be in it already.

**Ready-made threads in the lore** (`src/data/story.js`).
- **Ray's journal:** "The lights on Frostpeak are **back**" (so they come and go), and "**Scout barks
  at the mountain every night.**" Caspar has read this.
- **The bottle note:** someone long ago "came for the glowing stones under the white mountain".
  The "guardians of wood, sand and ice" stopped them. Those are Grizzle, the Dune King and
  Frostclaw, and Caspar has fought all three.
- **Nobody has said** who wrote the note, or where Scout came from.

**What the story can be built from:**

| Already in the game | Where | Used for |
|---|---|---|
| Wolf Moon every 10th night: 6 red wolves on Day 10, 2 more each time, 14 from Day 50 | `spawner.js` | The big nights. One chapter lands the morning after each. |
| Thunderstorm weather: rain, lightning, −9 warmth if you're not sheltered, fires need a roof | `game/time.js`, `gfx/weather.js`, `build/use.js` | The Storm Moon and the Great Storm |
| Snow wolves: 66 health, 13 damage (a Wolf Moon red wolf has about 48 health and does 9) | `data/creatures.js` | The Snow Moon |
| The Stone Circle: **8 standing stones** facing N, NE, E, SE, S, SW, W and NW, with the altar in the middle | `landmarks.js` | The climax |
| Press-E props, notes in the journal, `showDialog`, `showChoice` | `props.js`, `panels.js` | Every puzzle |
| Bandages (2 fibre and 1 herb) | `data/recipes.js` | Healing Scout |
| `R.teleScout` brings Scout to you | `scout.js` | The whistle (optional) |
| Talking to Ray after "stay" gives one line | `ray.js` | Ray's stories and hints |

**Limits:**
- **The fingerprint hashes `NODES`, `SITES`, the terrain and the lakes.** New spots go in their own
  table.
- **Weather:** `tests/time.test.js` pins the weather *rule*. Setting a storm for one story night
  leaves the rule and the test alone. It still changes that night's weather on purpose, so it's
  stated.
- **Saves:** `mergeSave` fills new `G.scout` fields from `newGameState()`, so old saves are safe.
- **Scout's damage stays as it is.** He already does a lot. No change to his bite or his fighting
  anywhere in this plan.

---

## 3. The story: *The Storm Dog of Kestrel Island*

### The idea in one paragraph

Long ago a ship came to Kestrel Island for the glowing stones. Its ship's boy, **Tomas** (12), made
friends with a red-gold island dog he called **Ember**, who barked at the mountain every night. The
captain stole the **three glowing stones that sit in the Stone Circle**. Those stones are what calm
the **Great Storm**, which comes once in a hundred years, when the lights on Frostpeak burn bright.
Tomas took the stones back and hid them, one near each guardian, but his ship sailed before he could
return them. Ember stayed on the island and had pups by the Stone Circle. **Scout is Ember's
great-great-great-grandpup.** Ray found him as a lost pup at the Stone Circle. He barks at the
mountain because **his wild family up there howls back.** Now the lights are back, and the Great
Storm is coming. Sam and Scout have to find Tomas's stones and put them back before the storm
arrives.

### Why this story suits Caspar
- **It answers a question he already has:** why Scout barks at the mountain. It's in a note he has
  read.
- **It makes his favourite character the hero.** In the end only Scout can find the way.
- **Scout gets a real character arc that changes nothing about how he fights.** Scout is **scared of
  thunder.** A storm dog who's scared of storms is something a lot of kids with dogs will recognise.
  At the climax he runs into the storm for Sam.
- **It follows his picks:**
  - a growing storm
  - a mystery he can solve
  - "things you find" (Tomas's pages) and "people you meet" (Ray tells Scout's story)
  - big nights to prepare for
  - hints only
- **There's a kid in it his own age,** Tomas, writing to whoever finds his pages.
- **There's a gentle lesson** (put back what was taken) with no blame on Sam.
- **It ends with a surprise** ("Visitors", "Surprise me"): at dawn, a wild red-gold dog on the
  mountain, and Scout howling to it.

### When it plays
- **It starts once Caspar has chosen "stay",** when the main quest is over and the days are empty.
- **Before that, only two small things happen,** both just for show: Scout trembles in thunder, and
  he howls at Frostpeak at dusk. They plant the question.
- **One chapter about every 10 days, landing the morning after a Wolf Moon.** If Caspar is far
  along when this ships, chapters come closer together, but never closer than 3 days apart. That
  way the Great Storm still lands before Day 100.
- **Each chapter needs Scout with you** (a friend, fed yesterday). If Scout has gone home hungry,
  the story waits.
- **The Day 100 ship always comes,** whether or not the story is finished. Nothing blocks the
  ending, and the story can be finished after Day 100.

### The chapters

| # | Ideal day | Chapter | What happens | Kind of moment |
|---|---|---|---|---|
| 1 | first morning after "stay" (or after the Day 20 Wolf Moon) | **The pup at the stones** | At camp Ray says Scout has been howling at Frostpeak again. "I found him as a pup, all alone, by the Stone Circle. No mum, no tracks. Just him, barking at that mountain." The lights on Frostpeak glow a little brighter that night. | Small and warm. It sets up the mystery. |
| 2 | after the Day 30 Wolf Moon | **The first dig** | Scout points WEST each morning. Near the west woods he **leads**, runs to a spot and digs: **the Green Stone** and **Tomas's page 1**. | Easy puzzle (P1) |
| 3 | after the Day 40 Wolf Moon | **The guardians' box** | Page 1 sends him to Tomas's box in the Old Iron Mine. It has a **picture lock** (P2). Inside: **the Gold Stone** and **page 2**. | Medium puzzle |
| 4 | after the Day 50 Wolf Moon (the biggest one) | **The scare** | Scout limps the next morning and won't fight today. Ray shows Sam how to wrap a paw: **a bandage and a cooked meal** heal him. That night, from far up the mountain, something howls back at Scout's whimper. | Caring, a little sad, and a clue |
| 5 | after the Day 60 Wolf Moon (a **Snow Moon**, C1) | **Paws in the dark** | Page 2 says Ember's family walk the snow at night "with paws that glow like the mountain stones". At night, a **glowing paw trail** starts from the Frozen Lake (P3). At its end: **the Blue Stone** and **page 3**, which tells the big secret. | Medium puzzle, brave |
| 6 | Day 70 (**Storm Moon**, C2) and Day 80 | **The storm grows** | The lights on Frostpeak blaze, storms come more often at night, and Scout trembles more. Caspar can put the stones in the circle (P4) whenever he's ready. They hum, but "something is still missing". | Big nights |
| 7 | first night from Day 85, once the stones are found | **The Great Storm** | The biggest storm the island has seen, at night. **Scout stops trembling, barks once, and runs into the storm.** Sam follows him to the Stone Circle (C3). Any stones not yet placed go in now (P4). Scout howls at the altar, lightning strikes, a blue beam reaches Frostpeak, and the storm breaks. Stars come out. | The big one |
| 8 | the dawn after | **Ember's family** | On the slope toward Frostpeak a **wild red-gold dog** stands and howls. Scout howls back, and it trots away. Ray says: "He was never barking at the mountain, kiddo. He was talking to his family." **Badge: Storm Dog.** A chip of blue stone goes on **Scout's collar and glows at night.** From then on, at dusk, Scout and the far-off dog sometimes howl to each other. | The payoff |

**The ending:** both Day 100 ship endings (`showEnding`) get a line about Scout. If the storm was
calmed: "Scout stands at the back of the boat, looking up at Frostpeak. Far away, something howls.
Scout barks once — see you, family." If it wasn't, a simpler Scout line. **Scout always comes home
with Sam.**

### Tomas's pages (draft text)

These are short, with big words in capitals, like the notes already in the game. Each one is under
80 words, so they're easy to read in one go.

**Page 1** (with the Green Stone, west woods)
> My name is TOMAS. I am the ship's boy, and I am twelve.
>
> We came for the GLOWING STONES. A red-gold dog met us on the beach. I named her EMBER. Every night
> she barks at the mountain.
>
> The captain stole three stones from the STONE CIRCLE. The old carvings say they calm the GREAT
> STORM. Without them it will never stop.
>
> I took them back. I hid them where the GUARDIANS can keep them safe. The next one is locked in my
> box in the OLD MINE. Only a friend of the guardians can open it.

**Page 2** (in the box, with the Gold Stone)
> You know the guardians! Then you are a friend of the island.
>
> We sail tomorrow. I could not put the stones back in time.
>
> The last stone is up in the SNOW. Ember's family live up there. They walk at NIGHT, and their paws
> glow like the mountain stones. Start at the FROZEN LAKE. Follow them.

**Page 3** (with the Blue Stone, end of the paw trail)
> Ember had PUPS by the Stone Circle. I cannot take them, and I cannot take her. My heart hurts.
>
> One day the mountain lights will burn bright again. Then a dog of Ember's family will know the way
> to the circle, even through the GREAT STORM.
>
> Put the stones back. Follow the dog.
>
> — Tomas

After page 3, **Ray** says, if you talk to him: "Found him as a pup... by the Stone Circle." He
looks at Scout. "Well, I'll be."

---

## 4. Puzzles and challenges

### What makes a good puzzle for Caspar (11)

- **One clear idea per puzzle,** like "count", "match", "remember", "follow" or "come back at night".
  No riddles that depend on wordplay, and no maths beyond counting.
- **Use what he already knows.** The best answers are things he learned by playing: the guardians he
  fought, where the woods, sands and snow are, and the fact that rain puts out fires.
- **He goes there and looks.** The answer is in the world, never in a menu. He has to stand somewhere
  and notice something.
- **Big, clear feedback.** A right answer gets a click, a glow and a sound. A wrong one gets a
  friendly "It doesn't fit", with no cost.
- **Never stuck for long. Every puzzle has three hint levels:**
  1. **The clue in Tomas's page.** It stays in the journal (J) to reread.
  2. **Scout.** He points the way each morning, leads when you're close, and sniffs or whines at the
     right thing.
  3. **Ask Ray.** Talk to Ray at camp and he gives a plain nudge, such as "Who guards the woods? You
     fought him yourself, kiddo." That's still a hint, not a marker.
- **Short reading.** Each page is under 80 words.
- **Exciting, never punishing.** The danger is in the nights, not the puzzles. The climax is easy to
  solve and big to watch.
- **Different kinds of puzzle,** getting a little harder through the middle and easier at the
  climax.

### The main puzzles (in story order)

**P1. Follow Scout** (chapter 2, easy, the tutorial)
- Each morning Scout looks WEST and whines (a toast). When Sam is within about 150 m of the spot,
  Scout **runs ahead and waits**, looking back.
- If Sam goes the wrong way, Scout runs back, barks and sets off again. At the spot he digs, and Sam
  presses E to help.
- **It teaches the "Scout leads" idea** that the rest of the story uses.
- When Sam is riding, Scout points instead of leading. He can't keep up with a horse.

**P2. The guardians' lock** (chapter 3, medium)
- Tomas's box in the Old Iron Mine has **three picture dials**, marked with a **tree**, a **sand
  dune** and a **snowflake**.
- Each dial turns through five pictures: bear, scorpion, white bear, wolf and rabbit.
- **The answer:** tree is the bear, dune is the scorpion, snowflake is the white bear. Those are the
  three guardians Caspar fought himself. Page 1 calls them "the guardians" but never says which
  animals they are, so the answer comes from his own adventure.
- **Hints:**
  - level 2: Scout growls softly when a dial shows the right guardian
  - level 3: Ray asks, "Who did you fight in the woods?"
- **Build note:** this needs a small new panel with three dials. It must work with the mouse and
  with touch, and its button clicks are handled the capture-phase way that `savefile.js` uses.

**P3. Paws in the dark** (chapter 5, medium, and brave)
- **Glowing paw prints** run from the Frozen Lake up toward Frostpeak. They **only show at night**.
- In the daytime, Scout sniffs the ground there and whines. That's the clue to come back after dark.
- The trail is about 150 m long, with a few turns, past a rock that's easy to spot. At its end, the
  Blue Stone sits in a little cairn.
- **The challenge:** going out at night, in the cold, where snow wolves live (the ice-fishing log
  already warns about them). With Scout, a torch and a fur coat it's tense but fair.
- **Build note:** the paws are a small glowing material, shown only at night. It gets warmed up
  behind the loading bar.

**P4. Put them back** (chapters 6–7, easy to medium, the matching puzzle)
- **Three of the eight standing stones have a broken notch:** the WEST, EAST and NORTH stones. Each
  one has a carving: a tree (west, toward the woods), a sun over dunes (east, toward the Dust Flats)
  and a snowflake (north, toward Frostpeak).
- Press E on a notched stone and choose which stone to put in, using the existing `showChoice`. The
  right one slides in and glows. A wrong one: "It doesn't fit. This stone is carved with a
  snowflake."
- **Two ways to solve it,** both his own knowledge: match the colours to the carvings (green to tree,
  gold to sun, blue to snowflake), or use the island's directions (woods west, desert east, mountain
  north).
- Scout sits by the right stone when Sam is holding the matching one.

### The big nights (challenges)

**C1. The Snow Moon** (Day 60 Wolf Moon)
- Snow wolves come down from Frostpeak instead of red wolves. It's the first sign the mountain is
  stirring.
- **The day before,** Scout sniffs the north wind and his fur stands up. The day summary says
  "Scout keeps looking north. Tomorrow's Wolf Moon will be a SNOW MOON."
- **Numbers to agree:** a snow wolf is much tougher than a red wolf (66 health and 13 damage,
  against about 48 and 9). So the suggestion is **8 snow wolves instead of 14 red wolves.** That's
  about 530 health to beat instead of about 680, but each hit is harder. To tune after Caspar has
  played it.

**C2. The Storm Moon** (Day 70 Wolf Moon)
- A thunderstorm all night, on top of the wolves.
- **What he has to prepare,** all from rules already in the game:
  - a **roof over the fire** (rain puts unroofed fires out)
  - a **roof over himself** (a storm takes 9 warmth if he's not sheltered)
  - **walls**, because Wolf Moon wolves aren't afraid of fire
- **The day before:** "The air smells like rain and Scout won't stop shaking. Tomorrow's Wolf Moon
  will be a STORM MOON — keep your fire under a roof!"
- **No new numbers.** It only sets the weather for that night.

**C3. The Great Storm** (chapter 7)
- A storm all night, with more lightning than usual and the Frostpeak lights blazing.
- **There are no wolves or predators during it** ("Even the wolves are hiding tonight"). The danger
  is the storm itself, and the drama is following Scout through it.
- **It can't be lost, only put off.** If Sam doesn't follow, Scout waits at the circle and comes back
  at dawn. The Great Storm returns each night, from 8 pm until dawn, until it's calmed. Days in
  between are cloudy.

### Optional extras (after the main story has been played)

- **The whistle.** A bonus box at the Stone Circle with a counting lock: "How many stones stand in
  the circle?" The answer is **8**, and he has to go and count them. Inside is **Tomas's whistle**,
  which calls Scout to you from anywhere (it uses the existing `R.teleScout`). A useful reward for a
  simple "go and look" puzzle.
- **The torn picture.** Scout digs up half of an old drawing of a place. Recognise the view (a split
  rock, three trees, the balloon on the skyline) and go there for a treasure.
- **Tracks.** Footprints that lead to a rare animal, which ties in with the animal journal.

**Taken out in review:**
- **The idol-placement puzzle:** the altar already takes all ten idols at once.
- **The tide puzzle:** there are no tides, and moving water would change the island.
- **The fog moon:** there's no fog weather, so it would need new graphics. The Snow Moon and Storm
  Moon use what's already there.
- **"Keep a fire burning":** the Storm Moon already covers it.
- **Scout getting "braver" by biting harder:** dropped. His arc is about courage in the storm, not
  damage.

---

## 5. The hotbar (not a spoiler)

Caspar asked to "change things in your hot bar". The hotbar is seven fixed tool slots today, so he
could mean either of two things:
- **Reorder the slots** (for example, the bow on key 2), or
- **Put other things in it**, such as food, bandages or the canteen.

**This isn't secret.** Ask him what he means, then make it its own step in IMPROVEMENTS.md. It's
separate from the story and he can test it straight away.
- `HOTBAR` lives in `src/data/`, so the rule part stays pure.
- The keyboard, the mouse wheel and touch (`touchcheck.mjs`) all need to follow the new layout.
- The layout gets saved, with a default for old saves.

---

## 6. How to build it

Each step follows the usual way of working:
- a written plan first
- `npm run check` while working
- a smoke step for each new feature
- `npm test` and `npm run parity` before each commit
- **Caspar plays it before the next step starts**

**Building rules:**
- **New modules, hooked by flags.** The story code goes in new modules imported after the chain tail
  in `src/main.js`: `src/story/scout-story.js` (chapters, leading, Ray's lines) and
  `src/story/great-storm.js` (the moon twists and the storm night). Older chain modules only read
  flags and import nothing new:
  - `R.scout.lead` and `R.scout.limp`, plus a thunder tremble, in `scout.js`
  - `R.raidKind` and `R.noPredators` in `spawner.js`
  - `R.rayTalk` in `ray.js`

  That's the same way `mount.js` talks to the creatures.
- **Pure rules in `src/game/`, with Vitest tests:**
  - which chapter is due (from the day, `G.scout`, the flags and last night's Wolf Moon)
  - when the Great Storm comes
  - the right answers for P2 and P4
- **Story data in `src/data/`:**
  - Tomas's pages and Ray's new lines in `story.js`
  - the three stones (and the whistle) as story items in `items.js`
  - the dig spots, the box, the paw trail and the notches as fixed coordinates in a new table. Not
    `SITES` and not `NODES`, and no `Math.random` while the world is built.
- **Saves:** new `G.scout` fields (chapter, the day of the last chapter, limp, scared) and story
  flags in `G.flags`, all with defaults in `newGameState()`. The key `stranded100_v3` and version 3
  stay. Extend the save round-trip test.
- **New materials** (the paws, the stone glow, the Frostpeak glow and Scout's collar chip) get warmed
  up behind the loading bar.
- **Scout's fighting and damage are not touched.** The only changes to Scout are leading, the limp
  (no fighting for that one day) and the thunder tremble (just for show: he still fights).

| Step | What | Why here |
|---|---|---|
| 1 | Hotbar, once Caspar says what he meant | Not secret, small, and testable straight away. |
| 2 | Chapter engine, **thunder tremble, dusk howl, chapter 1** | Proves the pacing rule and the save fields with the smallest change. |
| 3 | **Lead mode and P1** (chapter 2, page 1, the Green Stone) | The core new Scout behaviour. Everything after uses it. |
| 4 | **P2, the guardians' lock** (chapter 3) | The first real puzzle, and the new dial panel. |
| 5 | **The scare** (chapter 4) and **Ray's hints** | The emotional middle. Ray's hint system then works for every puzzle. |
| 6 | **The Snow Moon and P3, paws in the dark** (chapter 5) | Night-only glow, with the first moon twist. |
| 7 | **The Storm Moon, P4 at the circle, and the growing lights** (chapter 6) | Builds the storm up. The stones can go back early. |
| 8 | **The Great Storm, the dawn dog, the badge, the collar chip and the ending lines** (chapters 7–8) | The climax, once everything it needs exists. |
| 9 | Optional extras (the whistle, the torn picture, tracks) | Only once Caspar has played steps 2–8. |

---

### Step 2 in detail: the chapter engine, the thunder tremble, the dusk howl, chapter 1

**Status: built 28 Nov 2026, not committed.**
- All the checks pass: `npm test`, the smoke test (30/30) and ship (7/7).
- The meadow screenshot's drift (6.98) was already there: the last commit scores 7.33.
- Next, Caspar plays it before step 3 starts.

**The pure rule** (`src/game/scout-story.js`, tested in `tests/scout-story.test.js`):
- `chapterDue(s)` returns the chapter that's due now, or 0.
- **No chapters before "stay"** (Ray free and `rayChoice === 'stay'`), or while Scout isn't a friend.
- **Chapter n waits for its first day:** 21, 31, 41, 51, 61, 71 for chapters 1–6, each the morning
  after a Wolf Moon.
- **Each chapter after the first waits for the previous one to be done,** and for at least 3 days
  since it started.
- **A late player catches up:** a player who chose "stay" on Day 60 gets chapter 1 at once, then
  one about every 3 days.
- **Only built chapters are given.** In step 2 that's chapter 1.
- `howlsTonight(day, chapter)`: Scout howls every third evening before chapter 1, and every other
  evening after it.

**The story module** (`src/story/scout-story.js`, called once a second from `slowTick` in
`boot.js`, the way `updateMount` is):
- **On a new day,** or when a game loads, or when Scout becomes a friend again, it checks whether a
  chapter is due.
- **Chapter 1:**
  - A toast: Ray wants a word about Scout. Ray's E prompt shows 💬.
  - Talking to him plays the pup-at-the-Stone-Circle dialogue (`DIALOGS.scoutPup`), and the
    chapter is then done.
  - If Caspar doesn't talk to him, there's a gentle reminder each morning.
- **The thunder tremble** (just for show), during a thunderstorm while Scout is a friend:
  - he shivers and keeps a little closer
  - he whines now and then
  - a toast the first time each storm: "He hates thunder."
  - **He still fights exactly as before.**
- **The dusk howl,** from 19:00 to 20:00 on howling evenings:
  - Scout stops, turns to Frostpeak, lifts his nose and howls twice (a new `doghowl` sound), for
    about 5 seconds.
  - Not during a Wolf Moon, a storm, riding or sleep. A fight cancels it.
- **Saves:** `G.story = { ch, day, done }` is made only when chapter 1 starts. Older saves and
  games that haven't reached it save exactly as before, so the round trip is unchanged.

**Hooks in older modules** (flags only, no new imports):
- `scout.js`:
  - `s.howlT` and `s.howl`: stop, face Frostpeak, nose up
  - `s.scared`: the shiver, and following closer
  - `scoutPose` passes `howl` on
- `gltf-animals.js`: Scout's `Neck1` bone tilts up by `howl`. Each frame's tilt is undone before
  the mixer runs, so it can never build up.
- `ray.js`: `R.rayTalk()` goes first if Ray has something to say.
- `audio.js`: the new `doghowl` sound.

**Checks:**
- **The Vitest rule tests,** added to `npm run check`.
- **A smoke step, "scout's story":**
  - chapter 1 starts on Day 25 after "stay", with the toast and the 💬
  - the dialogue plays and marks the chapter done
  - no chapter 2 yet
  - a storm makes Scout shiver, with the toast
  - at 19:15 on a howling evening he stops, faces Frostpeak and lifts his head
  - zero page errors
- **A screenshot of the howl,** to judge the head tilt by eye.

**Not in this step:** the Frostpeak lights (step 7), and chapters 2 onward.

---

## 7. Decisions for Dad

**28 Nov 2026: Dad said to build every step without asking.** Each open decision below therefore
went with the plan's recommendation, and stays easy to change after Caspar has played.

1. **The story:** approved, *The Storm Dog*.
2. **Where Caspar's game is:** not known. The catch-up rule copes with any day: a chapter at most
   every 3 days, and the story waits for "stay".
3. **The helicopter choice:** left as it is. A player who leaves early misses the story.
4. **Numbers, as proposed:**
   - The Snow Moon: 8 snow wolves instead of 14 red wolves.
   - The limp: no fighting for that one day.
   - The Great Storm: no wolves or predators while it lasts.
   - **Scout's bite is never changed.**
5. **The hotbar:** without asking Caspar, the version built lets him **rearrange the seven slots**
   (click one slot, then another, to swap them). Putting food in the hotbar can come later if he
   meant that.
6. **The paw trail** (P3) is about 80 m long, not 150 m: the ground west of the Frozen Lake is
   steep further out (found with `tools/story/spots.mjs`).
7. **"The lights on Frostpeak"** are the aurora in the northern sky, which shows from anywhere on
   the island. It grows stronger chapter by chapter, blazes in the Great Storm and goes soft after
   it. A glow on the mountain itself would be hidden by the fog at night.
