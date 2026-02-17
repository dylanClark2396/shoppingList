import pandas as pd
import os
import json
import re
from openpyxl import load_workbook

# ===== CONFIG =====
EXCEL_FILE = "MasterProductList.xlsx"
OUTPUT_DIR = "output"
IMAGE_FOLDER = "images"
SKU_COLUMN = "sku_number"
# ===================


# ---------------------------
# Helpers
# ---------------------------

def slugify(text):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(text).strip())


def ensure_dirs():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, IMAGE_FOLDER), exist_ok=True)


def clean_column_names(df):
    df.columns = [
        col.strip()
        .lower()
        .replace(" ", "_")
        .replace("#", "number")
        for col in df.columns
    ]

    if "quanity" in df.columns:
        df.rename(columns={"quanity": "quantity"}, inplace=True)

    return df


def clean_sku(value):
    if pd.isna(value):
        return None

    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return str(value)

    return str(value).strip()


def normalize_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    return value


def extract_sheet_images(sheet, sheet_name):
    """
    Extract embedded images and map to real Excel row numbers.
    """
    image_map = {}

    if not hasattr(sheet, "_images"):
        return image_map

    print(f"{sheet_name}: Found {len(sheet._images)} embedded images")

    for idx, image in enumerate(sheet._images):
        try:
            anchor = image.anchor

            if hasattr(anchor, "_from"):
                excel_row = anchor._from.row + 1
            else:
                continue

            filename = f"{slugify(sheet_name)}_{idx+1}.png"
            filepath = os.path.join(OUTPUT_DIR, IMAGE_FOLDER, filename)

            with open(filepath, "wb") as f:
                f.write(image._data())

            image_map[excel_row] = f"{IMAGE_FOLDER}/{filename}"

            print(f"Mapped image {idx+1} → Excel row {excel_row}")

        except Exception as e:
            print(f"⚠️ Failed extracting image in {sheet_name}: {e}")

    return image_map


# ---------------------------
# Main Processing
# ---------------------------

def process_excel():
    ensure_dirs()

    wb = load_workbook(EXCEL_FILE)
    xls = pd.ExcelFile(EXCEL_FILE)

    all_data = []

    for sheet_name in xls.sheet_names:
        print(f"\nProcessing sheet: {sheet_name}")

        df = pd.read_excel(xls, sheet_name=sheet_name)
        df = clean_column_names(df)

        # Drop fully empty rows
        df.dropna(how="all", inplace=True)

        # Add TRUE Excel row numbers (header is row 1)
        df["excel_row_number"] = df.index + 2

        if SKU_COLUMN not in df.columns:
            print(f"Skipping {sheet_name} — no SKU column.")
            continue

        # Clean SKU
        df[SKU_COLUMN] = df[SKU_COLUMN].apply(clean_sku)

        # Drop rows without SKU
        df = df[df[SKU_COLUMN].notna() & (df[SKU_COLUMN] != "")]

        df["worksheet_name"] = sheet_name

        # Extract embedded images
        sheet = wb[sheet_name]
        embedded_images = extract_sheet_images(sheet, sheet_name)

        for _, row in df.iterrows():
            excel_row_number = row["excel_row_number"]

            record = {
                key: normalize_value(value)
                for key, value in row.items()
                if key != "excel_row_number"
            }

            record["row_index"] = int(excel_row_number) - 1

            # Map image using TRUE Excel row number
            record["image_local"] = embedded_images.get(int(excel_row_number))

            all_data.append(record)

    # Write JSON safely
    output_path = os.path.join(OUTPUT_DIR, "data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False, allow_nan=False)

    print("\n✅ Done.")
    print(f"📄 JSON saved to: {output_path}")
    print(f"🖼 Images saved to: {os.path.join(OUTPUT_DIR, IMAGE_FOLDER)}")


# ---------------------------
# Run
# ---------------------------

if __name__ == "__main__":
    process_excel()
