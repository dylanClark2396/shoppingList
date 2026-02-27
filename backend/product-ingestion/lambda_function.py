import boto3
import os
import re
import zipfile
import shutil
import xml.etree.ElementTree as ET
import pandas as pd
from decimal import Decimal

# ========= CONFIG =========
SKU_COLUMN = "sku"
PRODUCTS_TABLE = os.environ.get("PRODUCTS_TABLE", "Products")
PRODUCT_IMAGE_BUCKET = os.environ.get("PRODUCT_IMAGE_BUCKET")
IMAGES_PREFIX = "product-images"
# ==========================

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(PRODUCTS_TABLE)


# =========================
# 🔧 HELPERS
# =========================

def slugify(text):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', str(text))


def clean_columns(df):
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
    """
    Normalize a cell value to a Python/DynamoDB-safe type.
    - numpy scalars → Python natives
    - NaN / NaT → None  (filtered out before DynamoDB write)
    - Timestamps → ISO string
    - Non-integer floats → Decimal  (DynamoDB rejects float)
    - Float/int that is a whole number → int
    """
    if pd.isna(val):
        return None

    if isinstance(val, pd.Timestamp):
        return val.isoformat()

    # Convert numpy scalars (int64, float64, etc.) to Python natives
    if hasattr(val, 'item'):
        val = val.item()

    if key == SKU_COLUMN:
        if isinstance(val, (int, float)) and float(val).is_integer():
            return int(val)

    if isinstance(val, (int, float)) and float(val).is_integer():
        return int(val)

    if isinstance(val, float):
        return Decimal(str(val))

    return val


# =========================
# 📂 XLSX EXTRACTION
# =========================

def unzip_xlsx(excel_path, temp_dir):
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    with zipfile.ZipFile(excel_path, 'r') as zf:
        zf.extractall(temp_dir)


def map_images_to_rows(temp_dir, sheet_index):
    """Returns {excel_row_number: local_image_path} for one sheet."""

    ns = {
        "a":   "http://schemas.openxmlformats.org/drawingml/2006/main",
        "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
        "r":   "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }

    sheet_path = os.path.join(temp_dir, "xl", "worksheets", f"sheet{sheet_index}.xml")
    if not os.path.exists(sheet_path):
        return {}

    root = ET.parse(sheet_path).getroot()

    drawing_rel_id = None
    for elem in root.iter():
        if "drawing" in elem.tag:
            drawing_rel_id = elem.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )

    if not drawing_rel_id:
        return {}

    rels_path = os.path.join(
        temp_dir, "xl", "worksheets", "_rels", f"sheet{sheet_index}.xml.rels"
    )
    if not os.path.exists(rels_path):
        return {}

    drawing_file = None
    for rel in ET.parse(rels_path).getroot():
        if rel.attrib.get("Id") == drawing_rel_id:
            drawing_file = rel.attrib.get("Target")

    if not drawing_file:
        return {}

    drawing_path = os.path.normpath(
        os.path.join(temp_dir, "xl", drawing_file.replace("../", ""))
    )
    if not os.path.exists(drawing_path):
        return {}

    drawing_root = ET.parse(drawing_path).getroot()

    drawing_rels_path = os.path.join(
        os.path.dirname(drawing_path),
        "_rels",
        os.path.basename(drawing_path) + ".rels",
    )
    if not os.path.exists(drawing_rels_path):
        return {}

    rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in ET.parse(drawing_rels_path).getroot()
    }

    row_image_map = {}
    anchors = (
        drawing_root.findall(".//xdr:twoCellAnchor", ns)
        + drawing_root.findall(".//xdr:oneCellAnchor", ns)
    )

    for anchor in anchors:
        from_node = anchor.find("xdr:from", ns)
        if from_node is None:
            continue

        row_elem = from_node.find("xdr:row", ns)
        if row_elem is None or not row_elem.text:
            continue

        row_number = int(row_elem.text.strip()) + 1

        blip = anchor.find(".//a:blip", ns)
        if blip is None:
            continue

        rel_id = blip.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed"
        )
        if rel_id not in rel_map:
            continue

        image_path = os.path.normpath(
            os.path.join(temp_dir, "xl", rel_map[rel_id].replace("../", ""))
        )
        if os.path.exists(image_path):
            row_image_map[row_number] = image_path

    return row_image_map


# =========================
# 🔄 CORE PROCESSING
# =========================

CONTENT_TYPES = {
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".webp": "image/webp",
}


def process(excel_path, temp_dir):
    print("Unzipping workbook...")
    unzip_xlsx(excel_path, temp_dir)

    sku_index = {}
    xls = pd.ExcelFile(excel_path)

    for sheet_idx, sheet_name in enumerate(xls.sheet_names, start=1):
        print(f"\nProcessing sheet: {sheet_name}")

        df = pd.read_excel(excel_path, sheet_name=sheet_name)
        df = clean_columns(df)
        df.dropna(how="all", inplace=True)

        if SKU_COLUMN not in df.columns:
            print(f"  No '{SKU_COLUMN}' column — skipping.")
            continue

        row_image_map = map_images_to_rows(temp_dir, sheet_idx)
        df["excel_row"] = df.index + 2

        for _, row in df.iterrows():
            excel_row = int(row["excel_row"])
            sku_raw = row[SKU_COLUMN]

            if pd.isna(sku_raw):
                continue

            sku = str(sku_raw).strip()
            if not sku:
                continue

            slug_sku = slugify(sku)

            if sku not in sku_index:
                record = {}
                for key, value in row.items():
                    if key in ("excel_row", "images", "sheet_names"):
                        continue
                    record[key] = clean_value(value, key)

                record["sheet_names"] = [sheet_name]
                record["images"] = []
                sku_index[sku] = record
            else:
                record = sku_index[sku]
                record.setdefault("sheet_names", [])
                record.setdefault("images", [])
                if sheet_name not in record["sheet_names"]:
                    record["sheet_names"].append(sheet_name)

            # Upload image to S3 if present
            if excel_row in row_image_map and PRODUCT_IMAGE_BUCKET:
                source_image = row_image_map[excel_row]
                ext = os.path.splitext(source_image)[1].lower()
                image_count = len(record["images"]) + 1
                filename = (
                    f"{slug_sku}{ext}"
                    if image_count == 1
                    else f"{slug_sku}_{image_count}{ext}"
                )
                s3_key = f"{IMAGES_PREFIX}/{filename}"

                print(f"  Uploading image: {s3_key}")
                s3.upload_file(
                    source_image,
                    PRODUCT_IMAGE_BUCKET,
                    s3_key,
                    ExtraArgs={"ContentType": CONTENT_TYPES.get(ext, "application/octet-stream")},
                )

                record["images"].append(
                    f"https://{PRODUCT_IMAGE_BUCKET}.s3.amazonaws.com/{s3_key}"
                )

        print(f"  {len(df)} rows processed")

    shutil.rmtree(temp_dir, ignore_errors=True)

    # Write to DynamoDB — strip None values (DynamoDB rejects them)
    print(f"\nWriting {len(sku_index)} products to DynamoDB table '{PRODUCTS_TABLE}'...")
    with table.batch_writer() as batch:
        for product in sku_index.values():
            item = {k: v for k, v in product.items() if v is not None}
            batch.put_item(Item=item)

    print(f"Done. Total unique SKUs: {len(sku_index)}")
    return len(sku_index)


# =========================
# 🚀 LAMBDA HANDLER
# =========================

def handler(event, context):
    for record in event.get("Records", []):
        source_bucket = record["s3"]["bucket"]["name"]
        source_key = record["s3"]["object"]["key"]

        print(f"Triggered by s3://{source_bucket}/{source_key}")

        excel_path = "/tmp/MasterProductList.xlsx"
        temp_dir = "/tmp/temp_extract"

        try:
            s3.download_file(source_bucket, source_key, excel_path)
            count = process(excel_path, temp_dir)
            print(f"Successfully ingested {count} SKUs")
        finally:
            # Always clean up /tmp — Lambda reuses execution environments
            for path in [excel_path, temp_dir]:
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                elif os.path.exists(path):
                    os.remove(path)

    return {"statusCode": 200, "body": "OK"}
