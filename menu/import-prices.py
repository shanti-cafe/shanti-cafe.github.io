#!/usr/bin/env python3
"""
Importa os preços de price.ods para js/data.js (e para o destaque do açaí
em index.html). É executado automaticamente por menu/build.sh.

Uso:
    python3 menu/import-prices.py            # lê price.ods na raiz do projeto
    python3 menu/import-prices.py outro.ods

Regras:
- O preçário é a fonte de verdade dos PREÇOS.
- Os nomes, descrições e traduções continuam em js/data.js.
- Se aparecer um item novo no preçário que ainda não existe em js/data.js,
  o script para com erro e diz o que falta acrescentar (para o menu nunca
  sair incompleto).
- Itens que existem no site mas já não estão no preçário são apenas avisados.
"""

from __future__ import annotations

import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

T = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
X = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"

SHEET_COLUMNS = {
    "A": "menus",
    "D": "sandes",
    "G": "doces",
    "J": "acai",
    "M": "cafetaria",
}

ROOT = Path(__file__).resolve().parent.parent


def col_index(name: str) -> int:
    index = 0
    for char in name:
        index = index * 26 + (ord(char) - 64)
    return index - 1


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = value.replace("…", "...").lower()
    return re.sub(r"\s+", " ", value).strip(" .:")


def parse_price(raw: str) -> str | None:
    match = re.search(r"(\d+)[.,](\d{1,2})", raw)
    if not match:
        return None
    euros, cents = match.group(1), match.group(2).ljust(2, "0")
    return f"{int(euros)},{cents}"


def read_sheet(path: Path):
    """Devolve {nome_normalizado: {name, price, takeaway?}} a partir do .ods."""
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("content.xml"))

    rows = []
    for table in root.iter(f"{{{T}}}table"):
        for row in table.findall(f"{{{T}}}table-row"):
            cells: dict[str, str] = {}
            index = 0
            for cell in row.findall(f"{{{T}}}table-cell"):
                repeat = int(cell.get(f"{{{T}}}number-columns-repeated", "1"))
                text = " ".join(
                    "".join(p.itertext()) for p in cell.findall(f"{{{X}}}p")
                ).strip()
                if text:
                    cells[str(index)] = text
                index += min(repeat, 20)
            rows.append(cells)

    def cell(row, letter):
        return row.get(str(col_index(letter)), "")

    items: dict[str, dict] = {}
    store_names: set[str] = set()
    acai_mode = "loja"

    for row in rows:
        for letter, group in SHEET_COLUMNS.items():
            name = cell(row, letter).strip()
            if not name:
                continue

            # marcadores "Açaí na loja :" / "Açaí take away :" não têm preço
            if group == "acai":
                if norm(name).startswith("acai na loja"):
                    acai_mode = "loja"
                    continue
                if norm(name).startswith("acai take away"):
                    acai_mode = "levar"
                    continue

            price_cell = cell(row, chr(ord(letter) + 1)).strip()
            if not price_cell:
                continue

            price = parse_price(price_cell)
            if price is None:
                continue

            key = norm(name)
            entry = items.setdefault(key, {"name": name, "price": price})

            if group == "acai" and acai_mode == "levar" and key in store_names:
                entry["takeaway"] = price
            else:
                entry["price"] = price
                if group == "acai":
                    store_names.add(key)

    return items


def scan_data(text: str):
    """Mapeia nome normalizado -> posições no texto de js/data.js."""
    name_re = re.compile(r'name:\s*\{\s*pt:\s*"([^"]+)"')
    matches = list(name_re.finditer(text))
    found = {}

    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.end():end]
        price = re.search(r'price:\s*"([^"]+)"', block)
        if not price:
            continue
        key = norm(match.group(1))
        found[key] = {
            "name": match.group(1),
            "name_start": match.start(1),
            "price": price.group(1),
            "price_start": match.end() + price.start(1),
            "price_end": match.end() + price.end(1),
            "takeaway": None,
            "takeaway_start": None,
            "takeaway_end": None,
        }
        takeaway = re.search(r'takeaway:\s*"([^"]+)"', block)
        if takeaway:
            found[key]["takeaway"] = takeaway.group(1)
            found[key]["takeaway_start"] = match.end() + takeaway.start(1)
            found[key]["takeaway_end"] = match.end() + takeaway.end(1)

    return found


def apply_edits(text: str, edits):
    for start, end, value in sorted(edits, key=lambda edit: edit[0], reverse=True):
        text = text[:start] + value + text[end:]
    return text


def main() -> int:
    if len(sys.argv) > 1:
        sheet_path = Path(sys.argv[1])
    else:
        candidates = [
            path for path in ROOT.iterdir()
            if path.suffix.lower() == ".ods" and "price" in path.name.lower()
        ]
        if not candidates:
            print("! price.ods não encontrado — nada para importar.")
            return 0
        sheet_path = sorted(candidates)[0]

    sheet = read_sheet(sheet_path)
    data_path = ROOT / "js" / "data.js"
    text = data_path.read_text(encoding="utf-8")
    found = scan_data(text)

    missing = [entry["name"] for key, entry in sheet.items() if key not in found]
    if missing:
        print("! Estes itens estão no preçário mas não existem em js/data.js:")
        for name in missing:
            print(f"    - {name}")
        print("  Acrescenta-os ao menu em js/data.js (nome PT/EN, descrição) e volta a correr.")
        return 1

    edits = []
    changed = []
    for key, entry in sheet.items():
        target = found[key]
        if target["price"] != entry["price"]:
            edits.append((target["price_start"], target["price_end"], entry["price"]))
            changed.append(f'{target["name"]}: {target["price"]} -> {entry["price"]}')

        takeaway = entry.get("takeaway")
        if takeaway:
            if target["takeaway"] is not None:
                if target["takeaway"] != takeaway:
                    edits.append((target["takeaway_start"], target["takeaway_end"], takeaway))
                    changed.append(f'{target["name"]} (levar): {target["takeaway"]} -> {takeaway}')
            else:
                # acrescenta o campo takeaway a seguir ao price
                line_start = text.rfind("\n", 0, target["price_start"]) + 1
                indent = re.match(r"\s*", text[line_start:]).group(0)
                quote_end = target["price_end"] + 1  # fecha as aspas
                insert = f',\n{indent}takeaway: "{takeaway}"'
                edits.append((quote_end, quote_end, insert))
                changed.append(f'{target["name"]} (levar): {takeaway}')

    if edits:
        text = apply_edits(text, edits)
        data_path.write_text(text, encoding="utf-8")

    # destaque do açaí na página inicial
    index_path = ROOT / "index.html"
    html = index_path.read_text(encoding="utf-8")
    acai_highlights = (
        ("acai.bola", "Açaí 1 bola"),
        ("acai.copo", "Açaí 250 ml"),
        ("acai.bowl", "Açaí 450 ml"),
    )
    for ui_key, sheet_name in acai_highlights:
        entry = sheet.get(norm(sheet_name))
        if not entry:
            continue
        for suffix, value in (("store", entry["price"]), ("takeaway", entry.get("takeaway"))):
            if not value:
                continue
            pattern = re.compile(
                r'(<strong data-price="' + re.escape(ui_key) + r'\.' + suffix +
                r'">)[^<]*(<small>)',
                re.S,
            )
            html, count = pattern.subn(
                lambda m: m.group(1) + value + " " + m.group(2), html, count=1
            )
            if count:
                pass
    index_path.write_text(html, encoding="utf-8")

    extras = [found[key]["name"] for key in found if key not in sheet]

    print(f"Preçário: {sheet_path.name}")
    print(f"  {len(sheet)} itens lidos · {len(changed)} alterações")
    for line in changed:
        print(f"    - {line}")
    if extras:
        print("  Aviso: itens no site que não estão no preçário (preço mantido):")
        for name in extras:
            print(f"    - {name}")
    if not changed:
        print("  Tudo já estava atualizado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
