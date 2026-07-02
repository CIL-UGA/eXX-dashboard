import mysql.connector
import json
import os

# ── Database connection ───────────────────────────────────────────────────────
conn = mysql.connector.connect(
    host="mdt-aws-dev.cthr7xwftrcv.us-east-1.rds.amazonaws.com",
    port=3306,
    user="CAPRUSer",          # <-- confirm this user has SELECT granted on exx_database (see note below)
    password="CAP_2026!@",    # <-- update if using a different user/password
    database="eXX_database"
)
cursor = conn.cursor(dictionary=True)

os.makedirs("data", exist_ok=True)

def export(filename, query):
    cursor.execute(query)
    rows = cursor.fetchall()
    with open(f"data/{filename}", "w") as f:
        json.dump(rows, f, indent=2, default=str)
    print(f"Exported {len(rows)} rows -> data/{filename}")

# ── Reference tables ──────────────────────────────────────────────────────────
export("expedition.json",     "SELECT * FROM expedition")
export("expedition_leg.json", "SELECT * FROM expedition_leg")

# ── Food vendor surveys ───────────────────────────────────────────────────────
export("food_vendor.json",     "SELECT * FROM food_vendor")
export("foodware_survey.json", "SELECT * FROM foodware_survey")

# ── Store / brand surveys ─────────────────────────────────────────────────────
export("store.json",              "SELECT * FROM store")
export("packaging_survey.json",   "SELECT * FROM packaging_survey")
export("alternative_survey.json", "SELECT * FROM alternative_survey")
export("bag_survey.json",         "SELECT * FROM bag_survey")
export("bulk_survey.json",        "SELECT * FROM bulk_survey")
export("reuse_survey.json",       "SELECT * FROM reuse_survey")
export("brand_survey.json",       "SELECT * FROM brand_survey")

conn.close()
print("\nAll done!")
