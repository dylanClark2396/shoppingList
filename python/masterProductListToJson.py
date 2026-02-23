import pandas as pd
import os
import json
import re
import zipfile
import shutil
import xml.etree.ElementTree as ET

# ========= CONFIG =========
EXCEL_FILE = "MasterProductList.xlsx"
OUTPUT_DIR = "output"
IMAGE_DIR = os.path.join(OUTPUT_DIR, "images")
SKU_COLUMN = "sku"
# ==========================


def slugify(text):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(text))


def ensure_dirs():
    os.makedirs(IMAGE_DIR, exist_ok=True)


def clean_columns(df):
    """
    Normalize column names and alias sku_number → sku
    """
    df.columns = [
        col.strip()
        .lower()
        .replace(" ", "_")
        .replace("#", "number")
        .replace("sku_number", "sku")
        for col in df.columns
    ]
    return df


def clean_value(val, key=None):
    if pd.isna(val):
        return None

    if isinstance(val, pd.Timestamp):
        return val.isoformat()

    # Special handling for SKU column
    if key == SKU_COLUMN:
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
        return str(val).strip()

    if isinstance(val, float) and val.is_integer():
        return str(int(val))

    return val


# --------------------------
# Extract workbook to temp
# --------------------------

def unzip_xlsx():
    temp_dir = "temp_extract"

    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)

    with zipfile.ZipFile(EXCEL_FILE, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)

    return temp_dir


# --------------------------
# Map sheet → row → image path
# --------------------------

def map_images_to_rows(temp_dir, sheet_index):
    """
    Returns dict: {excel_row_number: image_file_path}
    """

    ns = {
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    }

    sheet_path = os.path.join(
        temp_dir, "xl", "worksheets", f"sheet{sheet_index}.xml"
    )

    if not os.path.exists(sheet_path):
        return {}

    tree = ET.parse(sheet_path)
    root = tree.getroot()

    drawing_rel_id = None

    for elem in root.iter():
        if "drawing" in elem.tag:
            drawing_rel_id = elem.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )

    if not drawing_rel_id:
        return {}

    rels_path = os.path.join(
        temp_dir,
        "xl",
        "worksheets",
        "_rels",
        f"sheet{sheet_index}.xml.rels"
    )

    if not os.path.exists(rels_path):
        return {}

    rel_tree = ET.parse(rels_path)
    rel_root = rel_tree.getroot()

    drawing_file = None

    for rel in rel_root:
        if rel.attrib.get("Id") == drawing_rel_id:
            drawing_file = rel.attrib.get("Target")

    if not drawing_file:
        return {}

    drawing_path = os.path.normpath(
        os.path.join(temp_dir, "xl", drawing_file.replace("../", ""))
    )

    if not os.path.exists(drawing_path):
        return {}

    drawing_tree = ET.parse(drawing_path)
    drawing_root = drawing_tree.getroot()

    drawing_rels_path = os.path.join(
        os.path.dirname(drawing_path),
        "_rels",
        os.path.basename(drawing_path) + ".rels"
    )

    if not os.path.exists(drawing_rels_path):
        return {}

    drawing_rels_tree = ET.parse(drawing_rels_path)
    drawing_rels_root = drawing_rels_tree.getroot()

    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in drawing_rels_root
    }

    row_image_map = {}

    anchors = (
        drawing_root.findall(".//xdr:twoCellAnchor", ns) +
        drawing_root.findall(".//xdr:oneCellAnchor", ns)
    )

    for anchor in anchors:

        from_node = anchor.find("xdr:from", ns)
        if from_node is None:
            continue

        row_elem = from_node.find("xdr:row", ns)
        if row_elem is None:
            continue

        text_value = row_elem.text
        if not text_value:
            continue

        row_number = int(text_value.strip()) + 1

        blip = anchor.find(".//a:blip", ns)
        if blip is None:
            continue

        rel_id = blip.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
        )

        if rel_id not in rel_map:
            continue

        image_target = rel_map[rel_id]

        image_path = os.path.normpath(
            os.path.join(temp_dir, "xl", image_target.replace("../", ""))
        )

        if os.path.exists(image_path):
            row_image_map[row_number] = image_path

    return row_image_map


# --------------------------
# MAIN PROCESS
# --------------------------

def process():
    ensure_dirs()

    print("Unzipping workbook...")
    temp_dir = unzip_xlsx()

    sku_index = {}

    xls = pd.ExcelFile(EXCEL_FILE)

    for sheet_idx, sheet_name in enumerate(xls.sheet_names, start=1):

        print("\n==============================")
        print(f"Processing Sheet: {sheet_name}")
        print("==============================")

        df = pd.read_excel(EXCEL_FILE, sheet_name=sheet_name)
        df = clean_columns(df)
        df.dropna(how="all", inplace=True)

        if SKU_COLUMN not in df.columns:
            continue

        row_image_map = map_images_to_rows(temp_dir, sheet_idx)

        df["excel_row"] = df.index + 2

        for _, row in df.iterrows():

            excel_row = int(row["excel_row"])
            sku = row[SKU_COLUMN]

            if pd.isna(sku):
                continue

            sku = str(sku).strip()
            if not sku:
                continue

            slug_sku = slugify(sku)

            if sku not in sku_index:

                record = {}

                for key, value in row.items():
                    if key == "excel_row":
                        continue

                    if key in ["images", "sheet_names"]:
                        continue

                    record[key] = clean_value(value, key)

                record["sheet_names"] = [sheet_name]
                record["images"] = []

                sku_index[sku] = record

            else:
                record = sku_index[sku]

                if not isinstance(record.get("sheet_names"), list):
                    record["sheet_names"] = []

                if not isinstance(record.get("images"), list):
                    record["images"] = []

                if sheet_name not in record["sheet_names"]:
                    record["sheet_names"].append(sheet_name)

            if excel_row in row_image_map:
                source_image = row_image_map[excel_row]
                ext = os.path.splitext(source_image)[1]

                image_count = len(record["images"]) + 1

                filename = (
                    f"{slug_sku}{ext}"
                    if image_count == 1
                    else f"{slug_sku}_{image_count}{ext}"
                )

                dest_path = os.path.join(IMAGE_DIR, filename)
                shutil.copy(source_image, dest_path)

                record["images"].append(f"images/{filename}")

        print(f"  ✔ {len(df)} rows processed")

    shutil.rmtree(temp_dir)

    output_json = os.path.join(OUTPUT_DIR, "data.json")

    print("\nWriting combined JSON...")

    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(list(sku_index.values()), f, indent=2, ensure_ascii=False)

    print("\nDONE.")
    print("Total unique SKUs:", len(sku_index))


if __name__ == "__main__":
    process()