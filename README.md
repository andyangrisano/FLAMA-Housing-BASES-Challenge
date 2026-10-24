# BASES Robotics: House Sim

A shared 3D model of an average Bay Area home: a single-story 1950s–60s ranch of 158 m² (~1,700 sq ft) with 3 bedrooms, 2 bathrooms, an attached garage and a back patio. It's furnished for a family of four. Each teammate drops one robot JSON file into `robots/` and the scene animates it through the house. You don't need to change any code to add a robot.

## Repo layout

```
index.html          Three.js scene (r160, no build step)
story.js            Construction story (Theatre.js timeline)
visuals.js          Sky + procedural textures
story-theatre.json  Saved Theatre.js camera keyframes
house.json          The house as data: rooms, doors, windows, fixtures, furniture templates, materials
robots/
  index.json        Plain array of robot filenames to load
  <name>.json       One file per robot (see ROBOT_PROMPT.md)
README.md
```

## Run locally

Browsers block `fetch()` on `file://` pages, so serve the folder over HTTP. Run the server **from inside this folder**; otherwise you get a file listing:

```bash
cd ~/BASES\ Challenge && python3 -m http.server 8000
```

Then open http://localhost:8000. On GitHub Pages it works as-is (Settings → Pages → deploy from branch, root folder).

## Using the scene

- **▶ Watch: robots build this house** plays the construction story (about 3 minutes, 14 chapters; see below). The finished house is then cut open, the furniture appears, and you're left in the interactive house. Use **Next / Back** to step through, or **Skip to the house**. You can orbit the camera at any time.
- **Make it messy** scatters crumbs, dust and juice spills plus socks, toys, a cord and shoes. Then press CleanSweep's button with *Route: react to the mess*: it plans its own path around the furniture and clutter. It reaches under furniture with its crevice arm and lifts the mop on rugs. At the end it reports what it couldn't reach and what you should pick up.
- **Follow** on a robot card switches to a chase camera behind that robot. Orbit or zoom while following to change the angle.
- **High quality** turns soft shadows and ambient occlusion on or off (turn it off on slower laptops). **Show FPS** displays frames per second and draw calls.

- **Furnished** toggle: full colours and materials, or the team's massing palette (dark boxes, no rugs) for clean diagrams.
- **Click anything.** A robot shows its spec and current waypoint. A piece of furniture shows its id, size, height off the floor, robot-relevant props and the names of its parts. A room shows its area, floor finish, doors, windows and contents.
- Camera buttons frame the whole house or any single room. You can also toggle room labels, robot paths, full-height walls and (in two-story mode) the upper floor.
- **Robots are on-demand.** Each one waits at its dock until you press its button (e.g. **▶ Make the bed**). Pick its options first; **Stop** sends it home. Status updates and "done" messages show under **Phone notifications**.
- **Speed:** 1x / 4x / 16x / 32x / 64x. A laundry cycle is about 2.5 hours of house time, so use 64x. Arm wobbles, folding panels, spinning drums, water, steam and bubbles run at normal speed, so you can still watch them at 64x.

## The robots

| Button | Robot | What you'll see |
|---|---|---|
| Make the bed | [BedMaker](robots/bedmaker.json): two arms on rails under the primary bed | Arms unfold from under the frame, pull the rumpled comforter straight, fold the sheet edge back, put the pillows back, then fold away |
| Clean the kitchen | [CleanSweep](robots/cleansweep.json): vacuum-mop robot + suction climber | Vacuums crumbs under the dining table, lifts its mop on the rug, leaves a wet sheen on the tile, reaches under the fridge with its crevice arm, then lifts the climber onto the island and the shower glass to wipe them |
| Do the laundry | [LaundryBot](robots/laundrybot.json): mobile arm with a 3-bin hamper and fold board | Empties two hampers and picks up a sock, loads the washer + pod, waits at its dock, moves the load to the dryer, folds on its fold board and delivers the stacks |
| Cook dinner | [ChefRail](robots/chefrail.json): two arms on a ceiling rail | Takes food from the fridge, dices it, fills the pot at the sink, boils and stirs (steam and bubbles), serves two bowls on the island, then loads the dishwasher and wipes the island |
| Take out the trash | [TrashBot](robots/trashbot.json): self-driving kitchen trash can | Opens its lid, pulls the drawstring to seal the bag, drives through the garage door, raises its can on a lift column and tips the bag into the landfill cart, relines itself from its bag cartridge and docks to charge |

Each robot lists what it deliberately doesn't do (`tasks_excluded`) and the cheap house changes it needs (`env_changes_required`). Click a robot to see them.

## The construction story

Based on the team's research, two robots build the house, and people do the rest.

**Robot 1 (outdoor):** a compact track loader with an autonomy kit (GPS, lidar, cameras) and a 3.5 m safety field. The field turns red and the robot stops when a person walks in. It changes tools at a rack on the lawn:

| Tool | What it does in the story |
|---|---|
| Grading blade (laser-guided) | Levels the building pad; the laser level on the tripod sets the height |
| Bucket | Digs the footing trenches along every outside wall |
| Plate compactor | Packs the gravel base |
| Auger | Drills the back-fence post holes |
| Screed head | Strikes off the wet slab after the crew pours it |
| 6 m boom + arm | Drops drywall stacks into rooms, sets trusses, lays sheathing and shingles, installs siding and gutters, paints trim, all from the ground |

**Robot 2 (indoor):** a 0.65 m wide base that fits the 0.82 m doors, with a lift column, a 6-axis arm with a tool changer, lidar, a dust vacuum and outrigger legs.
- In the living room it scans and sprays insulation.
- It lifts drywall sheets off the stack and screws them on, including a ceiling sheet with the outriggers down.
- It routs the outlet holes, sprays joint compound, sands with dust extraction, and paints.

**People:** framing (the crew tilts up the stud walls), the concrete pour, windows, plumbing, electrical, inspections, and supervising the robots.

The arms use inverse kinematics, so the tool tip actually tracks the sheet, screw, seam or truss it's working on. Machines drive along paths and turn smoothly, and the camera follows on a spring. The lot is a real ground mesh that the blade flattens. Grass, dirt, gravel, concrete, wood, OSB, shingles, siding and drywall use textures generated in code (no image downloads). The sky and its lighting come from a physically based sky model.

### Choreographing the camera with Theatre.js

The story runs on a [Theatre.js](https://www.theatrejs.com) timeline: one sequence for the whole ~3 minutes, with a **Camera** object on it. By default the camera follows the coded shots. To design your own shots:

1. Open the site with `?edit` at the end of the address (e.g. `http://localhost:8000/?edit`). The Theatre Studio panels appear.
2. Press **▶ Watch** to start the story, then scrub or play it on Theatre's timeline. **Next / Back** jump between chapters.
3. In Theatre's outline, select **Camera**, right-click its props → **Sequence all** (once).
4. Orbit the view to a shot you like and press **Capture camera view** in the side panel. This sets a keyframe at the playhead and switches the camera to *Keyframed here*. Repeat along the timeline; Theatre eases between your keyframes. You can also edit the numbers and curves directly in Studio.
5. Press **Save keyframes file**, put the downloaded `story-theatre.json` in the project folder (replacing the old one) and commit it. Everyone watching then sees your shots.

Set the Camera's **mode** back to *Automatic (coded shots)* for any stretch you want the code to film.

The story lives in `story.js`; the shared sky and textures live in `visuals.js`. Every trench, slab, stud wall, truss, roof slope and siding panel is built from `house.json`, so a change to the house changes the story too.

## Add a robot (three steps)

1. Write `robots/<yourname>.json` following ROBOT_PROMPT.md. Use the room and fixture `id`s from `house.json` (or click things in the scene) for your waypoints.
2. Append your filename to `robots/index.json`, e.g. `["vacuum.json", "laundry_arm.json"]`.
3. Reload. If your file fails to load, a red message in the side panel names the file and the error.

### Robot fields the scene reads

The full format is in [ROBOT_PROMPT.md](ROBOT_PROMPT.md); [robots/bedmaker.json](robots/bedmaker.json) is a worked example.

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
- **`only_if`** on a waypoint, e.g. `{ "Fold top edge back": "yes" }`, runs that waypoint only when the user picked that option. Options are written `"Label: choice A / choice B"`.
- **`auto_clean`** (cleaning robots): `{ "radius_m", "arm_reach_m", "vacuum_s", "mop_s", "rooms": [...], "parts": { "brush", "mop", "arm" } }`. With the option `Route: react to the mess`, the scene ignores `path` after the button press and plans the route itself around the clutter from **Make it messy**. Items marked `"demo_only": true` only appear in the scripted route.
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

Edit `house.json` to change the house; leave `index.html` alone.
