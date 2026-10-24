# ROBOT_PROMPT.md — paste this whole block into Claude, then your robot brief at the bottom

You are helping design one household robot for a team simulation of an average Bay Area home (Stanford BASES Robotics challenge). The scene is a Three.js page that loads house.json and one JSON file per robot; you are writing only that robot's JSON. Do not write any JavaScript. The scene already handles rendering and animation.

I will paste house.json below so you can use real room names, fixture ids and positions for the path.

## Deliverable: robots/<name>.json, in full

Units: metres, seconds, USD. Origin at the robot's floor-contact centre; +Y up; robot faces +Z.

```jsonc
{
  "name": "",                       // short, lowercase, matches filename
  "display_name": "",
  "task": "",                       // one sentence: what household job it does
  "trigger": {                      // robots are ON-DEMAND, never autonomous/scheduled
    "type": "phone_button",         // phone_button | voice | physical_button
    "label": "",                    // the button text the user sees, e.g. "Do the laundry"
    "options": [],                  // any choices the user makes when pressing, e.g. ["whites","colours"]
    "notify_on": []                 // when the user gets a phone notification, e.g. ["done","blocked","needs_help"]
  },
  "form_factor": "",                // humanoid | wheeled | arm_on_rail | embedded_appliance
  "footprint_m": [w, d],
  "height_m": 0,
  "reach_m": 0,                     // max arm reach from base, 0 if none
  "payload_kg": 0,
  "speed_mps": 0,                   // 0.6-1.0 wheeled, 0.4-0.8 humanoid
  "battery_h": 0,
  "bom_usd": 0,
  "cost_drivers": [["component", usd], ["component", usd], ["component", usd]],
  "env_changes_required": [],       // what the house must change for this robot to work; [] if none
  "tasks_excluded": [],             // sub-tasks you deliberately left out and why (one line each)
  "primitives": [                   // 15-40 shapes. type: box | cylinder | sphere
    { "type": "box", "size": [w,h,d], "position": [x,y,z], "rotation": [0,0,0], "color": "body" }
  ],
  "path": [                         // the robot's full task cycle through the house
    { "label": "start at dock", "room": "laundry", "position": [x,z], "dwell_s": 0 },
    { "label": "pick up hamper", "room": "bedroom_1", "fixture": "hamper_b1", "dwell_s": 45 }
  ],
  "cycle_minutes_estimate": 0,      // total robot time for one full task cycle
  "human_minutes_equivalent": 0     // how long the same job takes a person
}
```

## Rules

* Robots are on-demand, not autonomous. Nothing runs on a schedule or on its own judgement; every task cycle starts when a person presses a button in a phone app (or says a command). The first path waypoint must be the robot idle at its dock, and the second must be labelled with the button press that starts it. If the robot needs a human decision mid-task (which basket, which setting), put that in trigger.options so it is asked up front, and add a "needs_user": true waypoint where the robot would stop and notify rather than guess.
* color must be one of body, joint, accent (the scene maps these to the shared palette).
* Primitives are a massing model: body, base, wheels, mast, arm segments, gripper, sensor head. No cables, fasteners or detail.
* Every path waypoint must reference a real room id from house.json, and a real fixture id when it interacts with one. Path must respect doors: list a waypoint at each door the robot passes through. Use the width of those doors to check the robot fits; if it does not, say so in env_changes_required.
* bom_usd must be a real estimate with the three biggest drivers itemised. Use current component prices, not aspirational 2032 prices, and note any assumption.
* Keep scope honest. If part of the brief is an unsolved manipulation problem (folding deformables, handling liquids, tying bags), put it in tasks_excluded with one line of reasoning rather than pretending the robot does it. A smaller robot that is credible beats a bigger one that is not.
* Prefer changing the house over complicating the robot when the change is cheap: say which in env_changes_required.

## Optional: fixed parts and poses

Use these only when they make the robot clearer; robots that just drive around don't need them.

* `"fixed": true` on a primitive keeps it at the dock (the first waypoint) while the rest of the robot travels the path. Use it for parts that never move: rails, docking stations, wall or ceiling cameras.
* `"pose": "<name>"` on a primitive shows that part only while the robot is in that pose. Primitives without a pose are always shown.
* `"pose": "<name>"` on a waypoint switches the robot into that pose when it arrives, and the pose holds until a later waypoint sets another one. Typical poses are `"stowed"` and `"deployed"` (arms folded vs reaching), and the dock waypoint should set the starting pose.
* Every pose counts toward the 15-40 primitive limit, so keep each pose to the parts that actually change.

Example: robots/bedmaker.json keeps its rails and headboard camera `fixed`.

## Optional: show the work happening

The scene can animate the robot and the house. Use this so viewers can see what the robot actually does. The README's "Animation" section has the full reference, and robots/laundrybot.json and robots/chefrail.json are worked examples.

* `parts`: named joints with a `pivot` (and optional `parent`). Give arm primitives `"part": "<name>"`, then rotate the joint with `set` instead of drawing the arm twice.
* `items`: objects the robot handles (clothes, dishes, crumbs, a detachable unit), each with its own primitives. Item colours may use house materials such as `fabric_blue`, `water` or `orange`.
* `setup`: the "before" state applied when the button is pressed (mess on the floor, clothes in the hamper).
* On waypoints: `set` (move, turn, scale or show something smoothly over `over_s`; targets are parts, items or house furniture as `"@fixture.part"`), `attach` / `detach` (pick up and put down items), `motion` (repeating sweeps, stirring, spinning), `effects` (water, spray, steam, bubbles, dust, sparkle), `notify` (a phone notification), `heading_deg` (face a direction) and `only_if` (run only for a chosen option).
* Only animate what the robot really does. If a sub-task is in `tasks_excluded`, don't animate it.

## Output

Return the JSON in one code block, then a 4-line summary: form factor and why, BOM total, cycle time vs human time, and the single biggest risk in this design. No other prose.

house.json: [paste the file here]
