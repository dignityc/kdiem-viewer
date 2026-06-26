#!/usr/bin/env python3
"""Insert a real nested glossary table inside the original glossary form cell."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "K-DIEM 제안서1권-Working-SKKU-260626-merged.hwpx"
OUTPUT = ROOT / "K-DIEM 제안서1권-Working-SKKU-260626-merged-glossary-nested.hwpx"

HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
HH = "http://www.hancom.co.kr/hwpml/2011/head"
HC = "http://www.hancom.co.kr/hwpml/2011/core"
NS = {
    "hp": HP,
    "hp10": "http://www.hancom.co.kr/hwpml/2016/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
    "hc": "http://www.hancom.co.kr/hwpml/2011/core",
    "hh": "http://www.hancom.co.kr/hwpml/2011/head",
    "hhs": "http://www.hancom.co.kr/hwpml/2011/history",
    "hm": "http://www.hancom.co.kr/hwpml/2011/master-page",
    "hpf": "http://www.hancom.co.kr/schema/2011/hpf",
    "opf": "http://www.idpf.org/2007/opf/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "ooxmlchart": "http://www.hancom.co.kr/hwpml/2016/ooxmlchart",
    "hwpunitchar": "http://www.hancom.co.kr/hwpml/2016/HwpUnitChar",
    "config": "urn:oasis:names:tc:opendocument:xmlns:config:1.0",
}

BLUE = "179"
HEADER = "151"
GRAY_BORDER_FILL = "49"
WHITE_BORDER_FILL = "5"

ROWS = [
    ("약어", "Full Name / 한글명", "용어 해설"),
    ("JADC2", "Joint All-Domain Command and Control / 합동 전 영역 지휘통제", "전 영역 지휘결심·작전 수행을 데이터 중심으로 연결하는 개념"),
    ("K-JADC2", "Korean Joint All-Domain Command and Control / 한국형 합동전영역지휘통제체계", "한국군 작전 환경에 맞춘 JADC2 구현 체계"),
    ("KCCS", "Korea Command and Control System / 지휘통제정보공유체계", "전장 데이터 공유와 지휘결심 지원 기반 체계"),
    ("K-DIEM", "Korea-Defense Information Exchange Model / 한국형 국방 정보교환모델", "전장 체계 간 정보교환을 표준화하는 공통 데이터 모델"),
    ("KMTF", "Korean Message Text Format / 한국군 메시지 텍스트 포맷", "전장 체계 간 정형 메시지 교환 표준"),
    ("KMTF2.0", "Korean Message Text Format 2.0 / KMTF 2.0", "K-DIEM 설계의 주요 분석 대상 메시지 표준"),
    ("USMTF", "United States Message Text Format / 미군 메시지 텍스트 포맷", "KMTF2.0의 모태로 언급되는 메시지 표준"),
    ("MDR", "Metadata Registry / 국방 메타데이터표준", "표준 단어·도메인·항목·코드값 정합성 확인 기준"),
    ("NDR", "Naming and Design Rules / 명명 및 설계 규칙", "K-DIEM 스키마 이름과 구조 설계 기준"),
    ("NIEM", "National Information Exchange Model / 국가 정보교환모델", "정보교환 모델·스키마 구성 방식의 참조 표준"),
    ("XML", "Extensible Markup Language / 확장 가능 마크업 언어", "메시지와 스키마 산출물을 구조화해 표현하는 언어"),
    ("XSD", "XML Schema Definition / XML 스키마 정의", "XML 요소·속성·타입·제약조건을 정의하는 스키마 언어"),
    ("IEP", "Information Exchange Package / 정보교환 패키지", "업무 시나리오에서 실제 교환되는 XML 메시지 묶음"),
    ("IEPD", "Information Exchange Package Documentation / 정보교환 패키지 문서", "IEP 구조·스키마·샘플·검증 기준을 담은 산출물"),
    ("RDF", "Resource Description Framework / 자원 기술 프레임워크", "자원과 관계를 그래프 형태로 표현하는 데이터 모델"),
    ("OWL", "Web Ontology Language / 웹 온톨로지 언어", "개념·관계·제약조건을 정의하고 추론하는 언어"),
    ("SHACL", "Shapes Constraint Language / SHACL 제약 언어", "RDF 그래프의 구조와 제약조건 검증 언어"),
    ("SPARQL", "SPARQL Protocol and RDF Query Language / RDF 질의 언어", "RDF 그래프 패턴과 관계를 조회하는 질의 언어"),
    ("BFO", "Basic Formal Ontology / 기본 형식 온톨로지", "도메인 온톨로지 구축을 위한 상위 온톨로지"),
    ("JC3IEDM", "Joint C3 Information Exchange Data Model / 합동 C3 정보교환 데이터 모델", "NATO/MIP 계열 지휘통제 정보교환 데이터 모델"),
    ("AI", "Artificial Intelligence / 인공지능", "중복 식별·후보 정제·검증 자동화에 활용하는 분석 기술"),
    ("LLM", "Large Language Model / 대규모 언어모델", "자연어 기반 용어 검토와 문맥 판단을 보조하는 모델"),
]


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def remove_linesegarray(paragraph: ET.Element) -> None:
    for child in list(paragraph):
        if local_name(child.tag) == "linesegarray":
            paragraph.remove(child)


def set_cell_text(cell: ET.Element, text: str, *, char_pr: str) -> None:
    paragraphs = cell.findall(".//hp:p", NS)
    if not paragraphs:
        raise RuntimeError("cell paragraph missing")
    paragraph = paragraphs[0]
    runs = paragraph.findall("./hp:run", NS)
    if not runs:
        run = ET.SubElement(paragraph, f"{{{HP}}}run", {"charPrIDRef": char_pr})
    else:
        run = runs[0]
    run.set("charPrIDRef", char_pr)
    t = next((elem for elem in run if local_name(elem.tag) == "t"), None)
    if t is None:
        t = ET.SubElement(run, f"{{{HP}}}t")
    t.text = text
    for extra in runs[1:]:
        paragraph.remove(extra)
    for node in [elem for elem in paragraph.iter() if local_name(elem.tag) == "t" and elem is not t]:
        node.text = ""
    remove_linesegarray(paragraph)


def set_child(cell: ET.Element, name: str, attrs: dict[str, str]) -> None:
    child = next((elem for elem in list(cell) if local_name(elem.tag) == name), None)
    if child is None:
        child = ET.SubElement(cell, f"{{{HP}}}{name}")
    child.attrib.clear()
    child.attrib.update(attrs)


def make_cell(template: ET.Element, row: int, col: int, text: str, width: int, height: int, *, header: bool) -> ET.Element:
    cell = deepcopy(template)
    cell.set("borderFillIDRef", GRAY_BORDER_FILL if header else WHITE_BORDER_FILL)
    char_pr = HEADER if header else BLUE
    set_cell_text(cell, text, char_pr=char_pr)
    sub = cell.find(".//hp:subList", NS)
    if sub is not None:
        sub.set("textWidth", str(max(width - 900, 1000)))
        sub.set("vertAlign", "CENTER")
    set_child(cell, "cellAddr", {"colAddr": str(col), "rowAddr": str(row)})
    set_child(cell, "cellSpan", {"colSpan": "1", "rowSpan": "1"})
    set_child(cell, "cellSz", {"width": str(width), "height": str(height)})
    set_child(cell, "cellMargin", {"left": "220", "right": "220", "top": "80", "bottom": "80"})
    return cell


def ensure_white_border_fill(root: ET.Element) -> None:
    if root.find(f".//hh:borderFill[@id='{WHITE_BORDER_FILL}']", NS) is not None:
        return
    border_fills = root.find(".//hh:borderFills", NS)
    source = root.find(f".//hh:borderFill[@id='{GRAY_BORDER_FILL}']", NS)
    if border_fills is None or source is None:
        raise RuntimeError("border fill source missing")
    white = deepcopy(source)
    white.set("id", WHITE_BORDER_FILL)
    brush = white.find(".//hc:winBrush", NS)
    if brush is None:
        fill = ET.SubElement(white, f"{{{HC}}}fillBrush")
        brush = ET.SubElement(fill, f"{{{HC}}}winBrush")
    brush.set("faceColor", "#FFFFFF")
    brush.set("hatchColor", "#000000")
    brush.set("alpha", "0")
    border_fills.append(white)
    count = border_fills.get("itemCnt")
    if count and count.isdigit():
        border_fills.set("itemCnt", str(int(count) + 1))


def make_nested_table(template_table: ET.Element) -> ET.Element:
    table = deepcopy(template_table)
    for child in list(table):
        if local_name(child.tag) == "caption":
            table.remove(child)
    for tr in table.findall("./hp:tr", NS):
        table.remove(tr)

    widths = [6500, 21000, 19500]
    row_height = 1800
    for r, values in enumerate(ROWS):
        tr = ET.Element(f"{{{HP}}}tr")
        for c, text in enumerate(values):
            tr.append(make_cell(template_table.findall("./hp:tr", NS)[0].findall("./hp:tc", NS)[0], r, c, text, widths[c], row_height, header=(r == 0)))
        table.append(tr)

    table.set("id", "1129000001")
    table.set("zOrder", "900")
    table.set("numberingType", "NONE")
    table.set("pageBreak", "NONE")
    table.set("repeatHeader", "1")
    table.set("rowCnt", str(len(ROWS)))
    table.set("colCnt", "3")
    total_width = sum(widths)
    total_height = row_height * len(ROWS)
    for child in list(table):
        if local_name(child.tag) == "sz":
            child.set("width", str(total_width))
            child.set("height", str(total_height))
        elif local_name(child.tag) == "pos":
            child.set("treatAsChar", "1")
            child.set("flowWithText", "1")
        elif local_name(child.tag) == "inMargin":
            child.attrib.update({"left": "120", "right": "120", "top": "80", "bottom": "80"})
    return table


def find_glossary_table(root: ET.Element) -> ET.Element:
    for table in root.findall(".//hp:tbl", NS):
        text = "".join(t.text or "" for t in table.findall(".//hp:t", NS))
        if "영문 약어표(Full Name) 및 용어 해설" in text:
            return table
    raise RuntimeError("glossary table not found")


def update(root: ET.Element) -> None:
    outer = find_glossary_table(root)
    template = next(tbl for tbl in root.findall(".//hp:tbl", NS) if "문자열 기반" in "".join(t.text or "" for t in tbl.findall(".//hp:t", NS)))
    nested = make_nested_table(template)

    rows = outer.findall("./hp:tr", NS)
    content_cell = rows[2].find("./hp:tc", NS)
    if content_cell is None:
        raise RuntimeError("content cell not found")
    sub = content_cell.find("./hp:subList", NS)
    if sub is None:
        raise RuntimeError("content subList not found")
    for child in list(sub):
        sub.remove(child)
    p = ET.SubElement(sub, f"{{{HP}}}p", {"id": "0", "paraPrIDRef": "97", "styleIDRef": "0", "pageBreak": "0", "columnBreak": "0", "merged": "0"})
    run = ET.SubElement(p, f"{{{HP}}}run", {"charPrIDRef": "5"})
    run.append(nested)
    remove_linesegarray(p)


def serialize_xml(root: ET.Element) -> bytes:
    for prefix, uri in NS.items():
        ET.register_namespace(prefix, uri)
    body = ET.tostring(root, encoding="utf-8", xml_declaration=False)
    return b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + body


def main() -> None:
    with ZipFile(INPUT) as zin:
        files = {name: zin.read(name) for name in zin.namelist()}
    header_root = ET.fromstring(files["Contents/header.xml"])
    ensure_white_border_fill(header_root)
    root = ET.fromstring(files["Contents/section0.xml"])
    update(root)
    files["Contents/header.xml"] = serialize_xml(header_root)
    files["Contents/section0.xml"] = serialize_xml(root)
    ordered = list(files)
    if "mimetype" in ordered:
        ordered.remove("mimetype")
        ordered.insert(0, "mimetype")
    with ZipFile(OUTPUT, "w") as zout:
        for name in ordered:
            zout.writestr(name, files[name], compress_type=ZIP_STORED if name == "mimetype" else ZIP_DEFLATED)
    print(OUTPUT)


if __name__ == "__main__":
    main()
