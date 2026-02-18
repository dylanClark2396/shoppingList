import pandas as pd
import os
import json
import re
import xlwings as xw

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

# ---------------------------
# Image extraction using xlwings
# ---------------------------

def extract_sheet_images(sheet, sheet_name):
    """
    Extract all images from a sheet using xlwings and map to row numbers.
    Returns: {row_number: image_path}
    """
    image_map = {}
    pics = sheet.pictures
    print(f"{sheet_name}: Found {len(pics)} images via xlwings")

    for idx, pic in enumerate(pics):
        try:
            row = pic.top_left_cell.row
            filename = f"{slugify(sheet_name)}_{idx+1}.png"
            filepath = os.path.join(OUTPUT_DIR, IMAGE_FOLDER, filename)

            # Save the picture
            pic.api.Copy()  # copy to clipboard
            img = xw.Picture(picture=pic.api)
            img.save(filepath)

            # Map to row
            if row in image_map:
                # support multiple images per row
                if isinstance(image_map[row], list):
                    image_map[row].append(f"{IMAGE_FOLDER}/{filename}")
                else:
                    image_map[row] = [image_map[row], f"{IMAGE_FOLDER}/{filename}"]
            else:
                image_map[row] = f"{IMAGE_FOLDER}/{filename}"

            print(f"Mapped image {idx+1} → Excel row {row}")

        except Exception as e:
            print(f"⚠️ Failed extracting image in {sheet_name}: {e}")

    return image_map

# ---------------------------
# Main Processing
# ---------------------------

def process_excel():
    ensure_dirs()

    xls = pd.ExcelFile(EXCEL_FILE)
    all_data = []

    # Open workbook with xlwings
    wb = xw.Book(EXCEL_FILE)

    for sheet_name in xls.sheet_names:
        print(f"\nProcessing sheet: {sheet_name}")

        df = pd.read_excel(xls, sheet_name=sheet_name)
        df = clean_column_names(df)
        df.dropna(how="all", inplace=True)
        df["excel_row_number"] = df.index + 2

        if SKU_COLUMN not in df.columns:
            print(f"Skipping {sheet_name} — no SKU column.")
            continue

        df[SKU_COLUMN] = df[SKU_COLUMN].apply(clean_sku)
        df = df[df[SKU_COLUMN].notna() & (df[SKU_COLUMN] != "")]
        df["worksheet_name"] = sheet_name

        # Extract images via xlwings
        sheet = wb.sheets[sheet_name]
        embedded_images = extract_sheet_images(sheet, sheet_name)

        for _, row in df.iterrows():
            excel_row_number = row["excel_row_number"]
            record = {
                key: normalize_value(value)
                for key, value in row.items()
                if key != "excel_row_number"
            }
            record["row_index"] = int(excel_row_number) - 1
            record["image_local"] = embedded_images.get(int(excel_row_number))
            all_data.append(record)

    # Close workbook
    wb.close()

    # Write JSON
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
