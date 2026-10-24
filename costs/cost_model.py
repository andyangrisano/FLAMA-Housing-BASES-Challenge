"""Baseline manufacturing-cost projection for the team's robots, 2026-2050.

Method
------
1. Each robot's 2026 quantity-1 BOM (robots/<name>.json: bom_usd, bom_assumptions,
   cost_drivers) is itemized into parts that sum exactly to bom_usd.
2. Every part is mapped to one of the five hardware modules used in the
   "Optimus Extended Cost Projection Model" (Humanoid Robot Cost Map):
   actuators, sensors, compute, structure, battery/power.
3. Each part is projected with its module's cost index from that model
   (module midpoint / 2025-26 midpoint). Anchors: 2026, 2030, 2035, 2040 floor
   (held flat to 2050). Years in between are interpolated geometrically
   (constant annual % decline inside each segment).

Run:  python3 costs/cost_model.py   -> writes JSON + CSVs next to this file.
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# Optimus module midpoints (USD) from the cost map: 2025-26, 2030, 2035, 2040-50 floor.
OPTIMUS = {
    "actuators": [31000, 7500, 5000, 4000],
    "sensors":   [6500, 2750, 1500, 1000],
    "compute":   [4000, 1150, 600, 400],
    "structure": [6000, 2250, 1200, 800],
    "battery":   [2000, 950, 600, 500],
}
MODULE_LABEL = {
    "actuators": "Actuators (joints, grippers, drives)",
    "sensors": "Sensors & vision",
    "compute": "Compute & electronics",
    "structure": "Structure & housings",
    "battery": "Battery & power",
}
ANCHOR_YEARS = [2026, 2030, 2035, 2040]
YEARS = list(range(2026, 2051))


def module_index(module):
    base = OPTIMUS[module][0]
    return [v / base for v in OPTIMUS[module]]


def index_for_year(module, year):
    idx = module_index(module)
    if year >= ANCHOR_YEARS[-1]:
        return idx[-1]
    for i in range(len(ANCHOR_YEARS) - 1):
        y0, y1 = ANCHOR_YEARS[i], ANCHOR_YEARS[i + 1]
        if y0 <= year <= y1:
            t = (year - y0) / (y1 - y0)
            return idx[i] * (idx[i + 1] / idx[i]) ** t
    raise ValueError(year)


# (group, part, module, 2026 USD, note). Groups match each robot's cost_drivers.
ROBOTS = {
    "bedmaker": {
        "name": "BedMaker",
        "form": "Twin arms on under-bed rails",
        "bom_usd": 10800,
        "parts": [
            ("Arms (2 x 6-DOF)", "Shoulder/elbow QDD actuators (4 x $700)", "actuators", 2800, "2 per arm"),
            ("Arms (2 x 6-DOF)", "Wrist QDD actuators (8 x $300)", "actuators", 2400, "4 per arm"),
            ("Arms (2 x 6-DOF)", "Arm links, brackets, covers", "structure", 800, "Remainder of $6,600 arm driver"),
            ("Arms (2 x 6-DOF)", "Motor driver boards", "actuators", 600, "Optimus model counts drivers inside actuators"),
            ("Linear rails (2 x 1.95 m)", "Rail motors + drivers", "actuators", 500, "Belt-driven axes"),
            ("Linear rails (2 x 1.95 m)", "Extrusions, belts, carriages", "structure", 700, ""),
            ("Grippers (2)", "Soft pinch gripper actuation", "actuators", 600, "Hands sit in the actuator module"),
            ("Grippers (2)", "Resistive tactile fingertip pads", "sensors", 500, ""),
            ("Vision + compute", "Jetson Orin NX 16GB", "compute", 900, "Stated in BOM"),
            ("Vision + compute", "Headboard depth camera", "sensors", 335, "Stated in BOM"),
            ("Vision + compute", "Wrist cameras (2)", "sensors", 300, "Estimate"),
            ("Power, safety, other", "Bed-leg load cells (4)", "sensors", 80, "Estimate"),
            ("Power, safety, other", "48 V wall power supply", "battery", 150, "Wall-powered: no battery"),
            ("Power, safety, other", "E-stop + wiring harness", "structure", 60, "Estimate"),
            ("Power, safety, other", "Fabric skirt / cover", "structure", 75, "Estimate"),
        ],
    },
    "chefrail": {
        "name": "ChefRail",
        "form": "Twin arms on a ceiling rail",
        "bom_usd": 18100,
        "parts": [
            ("Arms (2 x 6-DOF, 3 kg)", "QDD joint actuators (12)", "actuators", 8400, "~$4,200 of actuators per arm"),
            ("Arms (2 x 6-DOF, 3 kg)", "Motor driver electronics", "actuators", 600, ""),
            ("Arms (2 x 6-DOF, 3 kg)", "Arm links and housings", "structure", 1000, "Remainder of $10,000 arm driver"),
            ("Vision + compute", "Jetson AGX Orin", "compute", 2000, "Stated in BOM"),
            ("Vision + compute", "Ceiling RGB-D camera", "sensors", 300, "Estimate"),
            ("Vision + compute", "Wrist cameras (2)", "sensors", 200, "Estimate"),
            ("Ceiling rail (4.2 m)", "Rail motor + driver", "actuators", 600, ""),
            ("Ceiling rail (4.2 m)", "Track, carriage, joist mounts", "structure", 1400, ""),
            ("End effectors + tools", "Parallel grippers (2)", "actuators", 1600, "Stated in BOM"),
            ("End effectors + tools", "Automatic tool changer", "actuators", 900, "Estimate"),
            ("End effectors + tools", "Dicer, spoon, ladle, tongs", "structure", 600, "Passive hardware"),
            ("Safety", "Safety light curtain", "sensors", 400, "Estimate"),
            ("Safety", "E-stop + power distribution", "battery", 100, "Wall-powered: no battery"),
        ],
    },
    "cleansweep": {
        "name": "CleanSweep",
        "form": "Vacuum-mop base + suction climber",
        "bom_usd": 2200,
        "parts": [
            ("Floor robot base", "Lidar", "sensors", 120, ""),
            ("Floor robot base", "Vacuum fan + brush roll motors", "actuators", 110, ""),
            ("Floor robot base", "Drive motors (2)", "actuators", 70, ""),
            ("Floor robot base", "Mop module + 2 tanks", "structure", 90, ""),
            ("Floor robot base", "Chassis + shell", "structure", 120, ""),
            ("Floor robot base", "5 Ah battery", "battery", 60, ""),
            ("Floor robot base", "Bumper + cliff sensors", "sensors", 40, ""),
            ("Floor robot base", "Main board + motor drivers", "compute", 40, ""),
            ("Mast + lift + crevice arm", "Telescoping mast + lift drive", "actuators", 200, ""),
            ("Mast + lift + crevice arm", "Crevice arm servos", "actuators", 120, ""),
            ("Mast + lift + crevice arm", "Mast tube + lift cradle", "structure", 130, ""),
            ("Suction climber", "4-chamber suction fan (12 V)", "actuators", 110, ""),
            ("Suction climber", "Tread motors (2)", "actuators", 70, ""),
            ("Suction climber", "Spray pump", "actuators", 30, ""),
            ("Suction climber", "Microfibre pad + housing", "structure", 120, ""),
            ("Suction climber", "Pressure + edge sensors", "sensors", 60, ""),
            ("Suction climber", "1 Ah battery", "battery", 30, ""),
            ("Vision + compute", "Jetson Orin Nano", "compute", 250, "Stated in BOM"),
            ("Vision + compute", "RGB-D camera", "sensors", 150, "Stated in BOM"),
            ("Dock station", "Water pumps", "actuators", 40, ""),
            ("Dock station", "Tanks + dock housing", "structure", 110, ""),
            ("Dock station", "Dust-bag fan", "actuators", 50, ""),
            ("Dock station", "Pad heater + charger", "battery", 80, ""),
        ],
    },
    "laundrybot": {
        "name": "LaundryBot",
        "form": "Mobile arm + fold board",
        "bom_usd": 9400,
        "parts": [
            ("Arm (6-DOF, 0.9 m)", "Joint actuators (6)", "actuators", 3100, "2 x $750, $550, 3 x $350"),
            ("Arm (6-DOF, 0.9 m)", "Motor driver board", "actuators", 300, ""),
            ("Arm (6-DOF, 0.9 m)", "Arm links + housings", "structure", 400, "Remainder of $3,800 arm driver"),
            ("Mobile base", "24 V 20 Ah battery", "battery", 450, ""),
            ("Mobile base", "Drive motors + wheels", "actuators", 350, ""),
            ("Mobile base", "Lidar", "sensors", 300, ""),
            ("Mobile base", "Bumpers + cliff sensors", "sensors", 100, ""),
            ("Mobile base", "Chassis", "structure", 300, ""),
            ("Vision + compute", "Jetson Orin NX 16GB", "compute", 900, "Stated in BOM"),
            ("Vision + compute", "RGB-D cameras (2)", "sensors", 400, ""),
            ("Gripper", "Soft pinch gripper actuation", "actuators", 350, ""),
            ("Gripper", "Tactile pads", "sensors", 200, ""),
            ("Fold board", "Panel servos (2)", "actuators", 160, ""),
            ("Fold board", "Panels + hinges", "structure", 240, ""),
            ("Body, dock, wiring", "Hamper body + 3 bins", "structure", 350, ""),
            ("Body, dock, wiring", "Pod cartridge", "structure", 120, ""),
            ("Body, dock, wiring", "Charging dock", "battery", 230, ""),
            ("Body, dock, wiring", "Wiring harness", "structure", 150, ""),
            ("Unitemized", "Gap between stated BOM and itemized assumptions", "structure", 1000,
             "laundrybot.json items sum to $8,400 vs bom_usd $9,400"),
        ],
    },
    "trashbot": {
        "name": "TrashBot",
        "form": "Self-driving kitchen can",
        "bom_usd": 1150,
        "parts": [
            ("Mobile base", "Depth camera", "sensors", 150, "Stated in BOM"),
            ("Mobile base", "Raspberry Pi 5 + AI accelerator", "compute", 150, "Stated in BOM"),
            ("Mobile base", "2D lidar", "sensors", 100, "Stated in BOM"),
            ("Mobile base", "Hub motors (2) + drivers", "actuators", 80, ""),
            ("Mobile base", "4-cell Li-ion pack", "battery", 40, ""),
            ("Lift-and-tip", "1.1 m telescoping linear actuator (~20 kg)", "actuators", 180, ""),
            ("Lift-and-tip", "Tilt actuator", "actuators", 70, ""),
            ("Lift-and-tip", "Steel frame", "structure", 70, ""),
            ("Seal + reline", "Drawstring-pull motor", "actuators", 50, ""),
            ("Seal + reline", "Bag-ring cartridge + reline mechanism", "structure", 100, "Like today's self-sealing cans"),
            ("Body, dock, sensors", "Can body", "structure", 50, ""),
            ("Body, dock, sensors", "Lid motor", "actuators", 25, ""),
            ("Body, dock, sensors", "Load cell (fill sensor)", "sensors", 15, ""),
            ("Body, dock, sensors", "Bumper switches", "sensors", 10, ""),
            ("Body, dock, sensors", "Charging dock", "battery", 60, ""),
        ],
    },
}


def build():
    out = {
        "method": __doc__.strip(),
        "years": YEARS,
        "anchor_years": ANCHOR_YEARS,
        "modules": {
            m: {"label": MODULE_LABEL[m], "optimus_usd": OPTIMUS[m],
                "index": [round(index_for_year(m, y), 4) for y in YEARS]}
            for m in OPTIMUS
        },
        "optimus_reference": {
            "name": "Optimus Gen 2 (reference humanoid)",
            "total_by_year": [round(sum(OPTIMUS[m][0] * index_for_year(m, y) for m in OPTIMUS)) for y in YEARS],
        },
        "robots": {},
    }
    for key, r in ROBOTS.items():
        total0 = sum(p[3] for p in r["parts"])
        assert total0 == r["bom_usd"], f"{key}: parts sum {total0} != bom {r['bom_usd']}"
        parts = []
        for group, part, module, usd, note in r["parts"]:
            parts.append({
                "group": group, "part": part, "module": module, "usd_2026": usd, "note": note,
                "by_year": [round(usd * index_for_year(module, y)) for y in YEARS],
            })
        by_module = {m: [sum(p["by_year"][i] for p in parts if p["module"] == m) for i in range(len(YEARS))]
                     for m in OPTIMUS}
        groups = []
        for g in dict.fromkeys(p["group"] for p in parts):
            groups.append({"group": g, "by_year": [sum(p["by_year"][i] for p in parts if p["group"] == g)
                                                   for i in range(len(YEARS))]})
        total = [sum(p["by_year"][i] for p in parts) for i in range(len(YEARS))]
        out["robots"][key] = {"name": r["name"], "form": r["form"], "bom_usd_2026": r["bom_usd"],
                              "total_by_year": total, "by_module": by_module, "groups": groups, "parts": parts}
    return out


def write(out):
    with open(os.path.join(HERE, "robot_costs.json"), "w") as f:
        json.dump(out, f, indent=1)

    with open(os.path.join(HERE, "robot_totals_by_year.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["year", *[r["name"] for r in out["robots"].values()], "Fleet (all robots)", "Optimus reference"])
        for i, y in enumerate(YEARS):
            vals = [r["total_by_year"][i] for r in out["robots"].values()]
            w.writerow([y, *vals, sum(vals), out["optimus_reference"]["total_by_year"][i]])

    with open(os.path.join(HERE, "robot_modules_by_year.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["robot", "module", *YEARS])
        for r in out["robots"].values():
            for m, vals in r["by_module"].items():
                w.writerow([r["name"], MODULE_LABEL[m], *vals])

    with open(os.path.join(HERE, "robot_parts_by_year.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["robot", "group", "part", "module", "note", *YEARS])
        for r in out["robots"].values():
            for p in r["parts"]:
                w.writerow([r["name"], p["group"], p["part"], MODULE_LABEL[p["module"]], p["note"], *p["by_year"]])


if __name__ == "__main__":
    data = build()
    write(data)
    yi = {y: YEARS.index(y) for y in ANCHOR_YEARS + [2050]}
    print(f"{'robot':<12}" + "".join(f"{y:>9}" for y in yi))
    for r in data["robots"].values():
        print(f"{r['name']:<12}" + "".join(f"{r['total_by_year'][i]:>9,}" for i in yi.values()))
    print(f"{'Optimus':<12}" + "".join(f"{data['optimus_reference']['total_by_year'][i]:>9,}" for i in yi.values()))
