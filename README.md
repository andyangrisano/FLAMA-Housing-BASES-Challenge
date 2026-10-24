# BASES Robotics: House Sim

A shared 3D model of an average Bay Area home: a single-story 1950s–60s ranch of 158 m² (~1,700 sq ft) with 3 bedrooms, 2 bathrooms, an attached garage and a back patio. It's furnished for a family of four. Each teammate drops one robot JSON file into `docs/robots/` and the scene animates it through the house. You don't need to change any code to add a robot.

## Repo layout

```
README.md             This file
docs/                 The website (GitHub Pages publishes this folder)
  index.html          Three.js scene (r160, no build step)
  visuals.js          Sky + procedural textures
  house.json          The house as data: rooms, doors, windows, fixtures, furniture templates, materials
  serve.py            Local server that never caches (python3 serve.py)
  robots/
    index.json        Plain array of robot filenames to load
    <name>.json       One file per robot
    ROBOT_PROMPT.md   How to write a robot file
costs/                Robot cost model and dashboard
```

## Run locally

Browsers block `fetch()` on `file://` pages, so serve the site over HTTP. Run the server **from inside the `docs` folder**; otherwise you get a file listing:

```bash
cd ~/BASES\ Challenge/docs && python3 serve.py
```

Then open http://localhost:8000. On GitHub Pages it works as-is (Settings → Pages → deploy from branch `main`, folder `/docs`). Live: https://andyangrisano.github.io/bases-house-sim/

## Using the scene

- **Mess level** (1 Light to 5 Max): the house is always a bit messy. Crumbs, dust and juice spills land on the floors, crumbs and sticky spills on the tables and counters (kitchen island and counters, dining table, coffee table, side table, TV console), plus a few socks, toys, a cord and shoes to steer around. Press CleanSweep's button and it cleans all of it: it plans its own path around the furniture and clutter, reaches under furniture with its crevice arm, lifts the mop on rugs, and at each dirty table or counter raises its mast and sets the climber on top to clean every spot. If the house is already clean when you press it, it gets messy again first. At the end it reports what you should pick up.
- **Follow** on a robot card keeps the camera on that robot from above and a little back. It glides after the robot as it drives through the house but doesn't swing around when the robot turns. Orbit or zoom while following to change the angle.
- **Shadows** turns shadows on or off (turn it off on slower laptops). **Show FPS** displays frames per second and draw calls.

- **Furnished** toggle: full colours and materials, or the team's massing palette (dark boxes, no rugs) for clean diagrams.
- **Click anything.** A robot shows its spec and current waypoint. A piece of furniture shows its id, size, height off the floor, robot-relevant props and the names of its parts. A room shows its area, floor finish, doors, windows and contents.
- Camera buttons frame the whole house or any single room. You can also toggle room labels, robot paths, full-height walls and (in two-story mode) the upper floor.
- **Robots are on-demand.** Each one waits at its dock until you press its button (e.g. **▶ Make the bed**). There are no settings to pick: each robot runs its standard routine. **Stop** sends it home. Status updates and "done" messages show under **Phone notifications**.
- **Speed:** 1x / 4x / 16x / 32x / 64x. A laundry cycle is about 2.5 hours of house time, so use 64x. Arm wobbles, folding panels, spinning drums, water, steam and bubbles run at normal speed, so you can still watch them at 64x.

## The robots

| Button | Robot | What you'll see |
|---|---|---|
| Make the bed | [BedMaker](docs/robots/bedmaker.json): two arms on rails under the primary bed | Arms unfold from under the frame, pull the rumpled comforter straight, fold the sheet edge back, put the pillows back, then fold away |
| Clean the kitchen | [CleanSweep](docs/robots/cleansweep.json): vacuum-mop robot + suction climber | Vacuums crumbs under the dining table, lifts its mop on the rug, leaves a wet sheen on the tile, reaches under the fridge with its crevice arm, then lifts the climber onto the island and the shower glass to wipe them |
| Do the laundry | [LaundryBot](docs/robots/laundrybot.json): mobile arm with a 3-bin hamper and fold board | Empties two hampers and picks up a sock, loads the washer + pod, waits at its dock, moves the load to the dryer, folds on its fold board and delivers the stacks |
| Cook dinner | [ChefRail](docs/robots/chefrail.json): two arms on a ceiling rail | Takes food from the fridge, dices it, fills the pot at the sink, boils and stirs (steam and bubbles), serves two bowls on the island, then loads the dishwasher and wipes the island |
| Take out the trash | [TrashBot](docs/robots/trashbot.json): self-driving kitchen trash can | Opens its lid, pulls the drawstring to seal the bag, drives through the garage door, raises its can on a lift column and tips the bag into the landfill cart, relines itself from its bag cartridge and docks to charge |

Each robot lists what it deliberately doesn't do (`tasks_excluded`) and the cheap house changes it needs (`env_changes_required`). Click a robot to see them.

## Add a robot (three steps)

1. Write `docs/robots/<yourname>.json` following ROBOT_PROMPT.md. Use the room and fixture `id`s from `docs/house.json` (or click things in the scene) for your waypoints.
2. Append your filename to `docs/robots/index.json`, e.g. `["vacuum.json", "laundry_arm.json"]`.
3. Reload. If your file fails to load, a red message in the side panel names the file and the error.

### Robot fields the scene reads

The full format is in [ROBOT_PROMPT.md](docs/robots/ROBOT_PROMPT.md); [robots/bedmaker.json](docs/robots/bedmaker.json) is a worked example.

| Field | Use |
|---|---|
| `name`, `display_name`, `task`, `trigger`, `form_factor`, `footprint_m`, `height_m`, `reach_m`, `payload_kg`, `bom_usd`, `cost_drivers`, `env_changes_required`, `tasks_excluded`, `cycle_minutes_estimate`, `human_minutes_equivalent` | Shown in the side panel when the robot is clicked |
| `primitives[]` | `{ type: "box"\|"cylinder"\|"sphere", size?: [w,h,d], radius?, radius_top?, height?, position: [x,y,z], rotation?: [x,y,z] deg, color: "body"\|"joint"\|"accent" }`. Positions are relative to the robot origin on the floor, and the robot's front is local +Z. |
| `path[]` | Waypoints with `label`, `room`, `fixture` and `dwell_s`. The robot goes to `position: [x,z]` if given. Otherwise it goes to the front of `fixture` (standing `meta.approach_clearance` off it), or to the room centre. A `needs_user: true` waypoint shows as "stops and notifies the user". |
| `speed_mps` | Travel speed between waypoints (straight lines; no collision checking yet) |
| `loop` | Defaults to `true`; `false` stops at the last waypoint |

Optional extras the scene understands (useful for arm_on_rail and embedded robots):

- **`"fixed": true` on a primitive** keeps it at the first waypoint (the dock) while the rest of the robot moves. Use it for rails, docks and wall or ceiling cameras.
- **`"pose": "<name>"` on a primitive** shows that part only while the robot is in that pose. **`"pose": "<name>"` on a waypoint** switches the robot into it, and the pose holds until another waypoint changes it.

### Animation (optional)

These are what make arms move smoothly and things in the house change. All of it is optional; a robot with none of it still drives its path.

- **`parts`**: named joints, `{ "arm": { "pivot": [x,y,z], "parent": "shoulder"? } }`. A primitive with `"part": "arm"` moves with that joint.
- **`items`**: things the robot carries or changes, such as clothes, dishes, crumbs or a detachable unit: `{ "sock": { "at": [x,y,z] | "@fixture" | "<part>", "offset"?, "rotation"?, "visible"?, "primitives": [...] } }`. Item colours may also be house materials (`"fabric_blue"`, `"water"`, `"orange"`…).
- **`setup`**: actions applied instantly when the button is pressed, to create the "before" state (the messy bed, the crumbs, the full hampers).
- **`only_if`** on a waypoint, e.g. `{ "Fold top edge back": "yes" }`, runs that waypoint only when it matches the option's default. Options are written `"Label: choice A / choice B"`; the site always uses the first choice and doesn't show a picker.
- **`auto_clean`** (cleaning robots): `{ "radius_m", "arm_reach_m", "vacuum_s", "mop_s", "rooms": [...], "parts": { "brush", "mop", "arm" } }`. With the default `Route: react to the mess`, the scene ignores `path` after the button press and plans the route itself from the current mess (floor dirt, plus tables and counters via the climber's `mast`, `lift` and `climber` parts). Items marked `"demo_only": true` only appear in the scripted route.
- **`heading_deg`** on a waypoint turns the robot to face that way while it works there. `"turn_to_path": false` stops a rail robot from turning as it moves.

Waypoint actions start when the robot arrives. Each can have `delay_s`, and lasts `over_s` (for `set`) or the waypoint's dwell (for `motion` / `effects`, unless `for_s` is given):

| Action | Example |
|---|---|
| `set` | `{ "arm": { "rotation": [30, 0, 0], "over_s": 2 } }`, plus `position`, `scale`, `visible` and `at` + `offset` for items. Targets are a robot part or item, or house furniture: `"@fridge"` or `"@fridge.door_right"` (part names show when you click furniture). Hinged doors use `"hinge": { "point": [x,y,z], "axis": "y", "deg": 100 }`. |
| `attach` / `detach` | `{ "sock": "fore" }` puts the item in the gripper (keeping where it is); `["sock"]` lets go of it in the world. |
| `motion` | `[{ "target": "fold_l", "type": "rotate" \| "move" \| "spin" \| "scale" \| "circle", "axis": "z", "amount": 90, "period_s": 2.4, "phase": 0.5 }]`: a repeating wobble (sweeping, stirring, spinning drums). `period_s` is real seconds. |
| `effects` | `[{ "type": "water" \| "spray" \| "steam" \| "bubbles" \| "dust" \| "sparkle", "at": "<target>" \| [x,y,z], "offset", "dir" }]` |
| `notify` | `"Washer started"` shows a phone notification |

## What's in the house

The furnishings are modelled on a typical Bay Area 3/2 ranch with a family of four. This isn't a scanned dataset. Furniture uses standard US catalogue sizes (queen/full/king beds, 0.91 m counters, 0.45 m seat height, 65" TV). The kitchen follows NKBA clearances (≥1.07 m aisles). Local touches: three-cart curbside waste (landfill, recycling, compost), an EV with a Level 2 charger in the garage, and a 6 ft sliding door to the patio.

| Room | Contents |
|---|---|
| Foyer | Front door (open), console table + key bowl, shoe bench, coat hooks with a coat and bag, doormat, runner |
| Living | 3-seat sofa with throw pillows, 2 armchairs, coffee table with TV remote and magazines, 65" TV on media console, side table + lamp, floor lamp, bookshelf, floor plant, area rug, a toy ball |
| Dining | Table for 6 + 6 chairs, sideboard, pendant light, fruit bowl, rug |
| Kitchen | Base cabinets with quartz tops, sink + faucet under a window, dishwasher, range with 4 burners, over-range microwave, upper cabinets, French-door fridge, island with 3 bar stools, coffee maker, toaster, trash + recycling pull bins, runner |
| Bedroom 2 (kid) | Full bed, nightstand + lamp, dresser, reach-in closet with clothes, hamper beside it, desk + chair + laptop, toy bin, scattered toy blocks and a stuffed animal, rug |
| Bedroom 3 | Full bed, nightstand + lamp, dresser, reach-in closet + hamper, desk + chair, rug |
| Primary | King bed, 2 nightstands + lamps, dresser, bed bench, armchair, rug, hamper by the closet wall; walk-in closet with clothes |
| Primary bath | Toilet, double vanity + mirror, glass shower, under-sink trash, towel bar, bath mat, small window |
| Hall bath | Toilet, single vanity + mirror, tub/shower with curtain, under-sink trash, towel bar, bath mat |
| Laundry | Front-load washer + dryer on pedestals (drum centre 0.8 m), folding counter, wall shelf + detergent, laundry basket |
| Garage | EV sedan, Level 2 charger, steel shelving with storage boxes, workbench with pegboard and tools, water heater, landfill/recycling/compost carts |
| Patio | Table with umbrella, 4 chairs, propane grill, 2 planters |

Floor finishes: hardwood (living, dining, hallway), carpet (bedrooms), tile (entry, kitchen, baths, laundry), concrete (garage), pavers (patio).

## `house.json` schema

Units are metres. The origin is the front-door threshold on the floor. +Y is up and +Z points into the house (Three.js convention). Three.js is right-handed, so when you stand on the street facing the front door, +X (the garage side) is on your **left** and the bedroom wing (−X) is on your right.

```jsonc
{
  "meta": {
    "floor_area_m2": 158.0,        // conditioned rooms only (no garage/patio)
    "ceiling_height": 2.44, "hallway_width": 1.07,
    "two_story": false,            // true → apply two_story_variant
    "wall_thickness": 0.1, "dollhouse_wall_height": 1.2, "door_height": 2.04,
    "floor_thickness": 0.05, "floor_to_floor": 2.74,
    "approach_clearance": 0.35     // robot stand-off for fixture waypoints
  },
  "materials": { "<name>": "#hex" },          // used in Furnished mode
  "transparent_materials": { "glass": 0.35 }, // opacity per material
  "rooms": [
    { "id", "name", "floor": 0, "origin": [x, z], "size": [w, d], "fixtures": ["ids"],
      "finish": "hardwood" | "carpet" | "tile" | "concrete" | "pavers",
      "outdoor"?: true, "conditioned"?: false, "void"?: true }
  ],
  "doors": [
    { "id", "between": ["roomA", "roomB" | "outside"], "position": [x, z], "width",
      "type"?: "interior" | "exterior" | "bifold" | "garage" | "slider" | "opening",
      "height"?: 2.04, "floor"?: 0, "leaf"?: false,
      "swing"?: { "into": "<room id>", "hinge": "start" | "end", "open_deg": 90 } }
  ],
  "windows": [
    { "id", "room", "position": [x, z], "width", "sill", "height" }
  ],
  "fixtures": [
    { "id", "type", "room", "template"?: "<template name>",
      "position": [x, z], "size": [w, h, d], "rotation": 0,
      "elevation"?: 0,             // base height above the floor (TV on console, upper cabinets, items on counters)
      "material"?: "<name>",       // for template-less boxes (rugs, mirrors)
      "inside"?: "<fixture id>",   // e.g. a hamper inside a closet
      "props"?: { } }
  ],
  "templates": {
    "<name>": { "size": [w, h, d], "parts": [ { "name", "type": "box"|"cylinder"|"sphere", "size" | "radius"/"height",
                                               "position": [x, y, z], "rotation"?: [x, y, z], "material" } ] }
  },
  "stairs": null,
  "two_story_variant": { "meta", "rooms", "doors", "fixtures", "stairs" }   // replaces/extends by id
}
```

- **Rooms** are wall-centreline rectangles. Walls are generated wherever two different rooms touch, or where a room meets the outside. Doors and windows on a wall line cut it.
- **Fixture rotation** is in degrees about +Y. At `0` the front (local +Z) faces +Z. `90` faces +X, `180` faces −Z and `270` faces −X. `position` is the footprint centre.
- **Templates** are drawn in the fixture's local frame (origin at the footprint centre on the floor, front = +Z). If a fixture's `size` differs from its template's, the parts are scaled to fit. Counters use this to come in different widths.
- **Part names** (`door_left`, `drawer_0_1_handle`, `sink_basin`, `door_glass`…) are stable, so robot files can refer to `fridge.handle_left` and so on.
- **Robot-relevant props** use these keys where they apply: `surface_height`, `seat_height`, `under_clearance` (gap a vacuum can drive under), `shelf_heights`, `rod_height`, `drum_center_height`, `door_open_reach`, `movable`, `graspable` (small clutter), `edge_height` (rug thresholds), `tucks_under`.
- Door widths: interior 0.82 m and exterior 0.915 m, all 2.04 m tall. Exceptions: the laundry closet has a 1.52 m bifold, the patio has a 1.83 m slider and the garage vehicle door is 4.88 × 2.13 m.

### Rooms

| id | Room | Size (m) | Area (m²) |
|---|---|---|---|
| foyer | Foyer / Entry | 2.0 × 5.2 | 10.40 |
| living | Living Room | 5.8 × 5.2 | 30.16 |
| dining | Dining | 3.4 × 4.8 | 16.32 |
| kitchen | Kitchen | 4.4 × 4.8 | 21.12 |
| hallway | Bedroom Hallway | 8.0 × 1.07 | 8.56 |
| bed2 | Bedroom 2 | 4.0 × 3.8 | 15.20 |
| bed3 | Bedroom 3 | 4.0 × 3.8 | 15.20 |
| primary | Primary Bedroom | 4.4 × 5.13 | 22.57 |
| wic | Primary Walk-in Closet | 2.0 × 1.0 | 2.00 |
| primary_bath | Primary Bath | 3.6 × 3.0 | 10.80 |
| laundry | Laundry Closet | 2.0 × 1.13 | 2.26 |
| bath2 | Hall Bath | 1.6 × 2.13 | 3.41 |
| garage | Garage (2-car) | 6.1 × 6.1 | 37.21 (not counted) |
| patio | Back Patio | 5.4 × 3.0 | 16.20 (not counted) |

Edit `docs/house.json` to change the house; leave `docs/index.html` alone.
