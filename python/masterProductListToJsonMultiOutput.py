import pandas as pd
import os
import json
import re
import hashlib
import xlwings as xw

# ========= CONFIG =========
EXCEL_FILE = "MasterProductList.xlsx"
OUTPUT_DIR = "output"
IMAGE_DIR = os.path.join(OUTPUT_DIR, "images")
SKU_COLUMN = "sku_number"
VISIBLE_EXCEL = False
# ==========================


# --------------------------
# Helpers
# --------------------------

def slugify(text):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(text))


def ensure_dirs():
    os.makedirs(IMAGE_DIR, exist_ok=True)


def clean_columns(df):
    df.columns = [
        col.strip().lower().replace(" ", "_").replace("#", "number")
        for col in df.columns
    ]
    return df


def clean_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return val


def file_hash(path):
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


# --------------------------
# IMAGE EXTRACTION
# --------------------------

def extract_images(sheet, sheet_name, sku_lookup):
    image_map = {}
    seen_hashes = {}

    shapes = sheet.api.Shapes
    print(f"\n[Image Extraction] {sheet_name}")
    print(f"Shapes found: {shapes.Count}")

    for i in range(1, shapes.Count + 1):
        shape = shapes.Item(i)

        try:
            if shape.Type == 13:  # msoPicture
                row = shape.TopLeftCell.Row

                if row not in sku_lookup:
                    continue

                sku = slugify(sku_lookup[row])
                if row not in image_map:
                    counter = 1
                else:
                    counter = len(image_map[row]) + 1

                if counter == 1:
                    base_filename = f"{sku}.png"
                else:
                    base_filename = f"{sku}_{counter}.png"
                path = os.path.abspath(os.path.join(IMAGE_DIR, base_filename))

                # Export using chart trick
                shape.Copy()
                chart = sheet.api.ChartObjects().Add(0, 0, shape.Width, shape.Height)
                chart.Chart.Paste()
                chart.Chart.Export(path)
                chart.Delete()

                # Deduplicate
                img_hash = file_hash(path)

                if img_hash in seen_hashes:
                    os.remove(path)
                    final_filename = seen_hashes[img_hash]
                else:
                    seen_hashes[img_hash] = base_filename
                    final_filename = base_filename

                image_map.setdefault(row, []).append(f"images/{final_filename}")

                print(f"  ✔ {sku} → image saved")

        except Exception as e:
            print(f"  ✖ Failed on shape {i}: {e}")

    return image_map


# --------------------------
# MAIN PROCESS
# --------------------------

def process():
    ensure_dirs()

    print("Opening Excel...")

    app = xw.App(visible=VISIBLE_EXCEL)

    # 🚀 Speed optimizations
    app.screen_updating = False
    app.display_alerts = False
    app.calculation = 'manual'

    wb = app.books.open(EXCEL_FILE)

    for sheet in wb.sheets:
        sheet_name = sheet.name

        print("\n==============================")
        print(f"Processing Sheet: {sheet_name}")
        print("==============================")

        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name)
        df = clean_columns(df)
        df.dropna(how="all", inplace=True)

        if SKU_COLUMN not in df.columns:
            print("  ⚠ SKU column not found — skipping")
            continue

        df[SKU_COLUMN] = df[SKU_COLUMN].apply(clean_value)

        # Remove rows without SKU
        df = df[df[SKU_COLUMN].notna() & (df[SKU_COLUMN] != "")]

        if df.empty:
            print("  ⚠ No valid SKU rows")
            continue

        df["excel_row"] = df.index + 2

        # Build row → SKU lookup
        sku_lookup = {
            int(row["excel_row"]): row[SKU_COLUMN]
            for _, row in df.iterrows()
        }

        # Extract images
        image_map = extract_images(sheet, sheet_name, sku_lookup)

        # Drop legacy image columns
        df.drop(columns=["image", "image_local", "images"],
                inplace=True,
                errors="ignore")

        records = []

        for _, row in df.iterrows():
            excel_row = int(row["excel_row"])

            record = {
                key: clean_value(value)
                for key, value in row.items()
                if key != "excel_row"
            }

            record["images"] = image_map.get(excel_row, [])
            records.append(record)

        # Write per-sheet JSON
        sheet_filename = slugify(sheet_name) + ".json"
        sheet_path = os.path.join(OUTPUT_DIR, sheet_filename)

        with open(sheet_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)

        print(f"  ✔ JSON exported: {sheet_filename}")
        print(f"  ✔ Records: {len(records)}")

    wb.close()
    app.quit()

    print("\nDONE.")
    print("Images folder:", IMAGE_DIR)


if __name__ == "__main__":
    process()
