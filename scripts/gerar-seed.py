#!/usr/bin/env python3
"""Gera o conteúdo inicial (seed/) a partir do catálogo consolidado:
um PDF por produto (a página do produto no catálogo) + capa JPEG de cada um.
Uso: python3 scripts/gerar-seed.py "<caminho do catálogo consolidado>.pdf"
"""
import json, re, shutil, sys, unicodedata
from pathlib import Path
import fitz

CARD, ENDO, IVL, ACES = 'Cardiologia Intervencionista', 'Endovascular', 'IVL (Litotripsia Intravascular)', 'Acessórios'
LEPU, APT, BROS, VENUS, SIM, TT, OPT, ZYL, SHUN = 'LEPU Medical', 'APT Medical', 'Brosmed', 'Venus Medtech', 'Simeks', 'TT Medical', 'Optimed', 'Zylox-Tonbridge', 'Shunmei'

# página do catálogo, nome, descrição, área, linha, fabricante (conferidos no sumário e em cada página)
P = [
 (5,'Vesselin®','Balão coronário farmacológico com paclitaxel',CARD,'Linha Coronária',LEPU),
 (6,'Vesscide®','Sistema de balão de corte',CARD,'Linha Coronária',LEPU),
 (7,'NC Tadpole™','Cateter balão coronário não complacente',CARD,'Linha Coronária',LEPU),
 (8,'Mini Tadpole™','Cateter balão coronário semicomplacente',CARD,'Linha Coronária',LEPU),
 (9,'GuReater®','Sistema de stent coronário eluidor de sirolimo',CARD,'Linha Coronária',LEPU),
 (10,'Orien™','Cateter guia',CARD,'Linha Coronária',LEPU),
 (11,'Partner™','Sistema de stent coronário farmacológico com sirolimus',CARD,'Linha Coronária',LEPU),
 (12,'Elong™','Microcateter',CARD,'Linha Coronária',APT),
 (13,'Expressman™','Cateter de extensão guia',CARD,'Linha Coronária',APT),
 (14,'Anyreach™','Fio-guia PTCA',CARD,'Linha Coronária',APT),
 (15,'March®','Cateter guia',CARD,'Linha Coronária',APT),
 (16,'Conqueror™','Cateter de balão para angioplastia coronária transluminal percutânea subcutânea (PTCA)',CARD,'Linha Coronária',APT),
 (17,'Aperi™ SC','Cateter balão coronário semicomplacente',CARD,'Linha Coronária',BROS),
 (18,'Aperi™ NC','Cateter balão coronário não complacente de alta pressão',CARD,'Linha Coronária',BROS),
 (20,'MemoPart™','Oclusores para fechamento percutâneo',CARD,'Linha Estrutural',LEPU),
 (21,'MemoCarna®','Oclusor para comunicação interatrial (CIA)',CARD,'Linha Estrutural',LEPU),
 (22,'Tipflect™','Bainha direcionável descartável',CARD,'Linha Estrutural',LEPU),
 (23,'Braidin™ Pro','Bainha guia com válvula ajustável',CARD,'Linha Estrutural',APT),
 (24,'VenusA-Pro™','Sistema de liberação recuperável para implante transcateter de válvula aórtica',CARD,'Linha Estrutural',VENUS),
 (25,'SimValve™ FLEX','Cateter balão PTV de baixo perfil e flexível',CARD,'Linha Estrutural',SIM),
 (26,'SimValve™ Force','Cateter balão para valvuloplastia',CARD,'Linha Estrutural',SIM),
 (27,'ValvuloPro®','Cateter-balão para valvuloplastia',CARD,'Linha Estrutural',TT),
 (30,'Supercross Pro™','Cateter balão PTA',ENDO,'Linha Periférica',LEPU),
 (31,'Tresfort™ Armor','Cateter balão de ultra-alta pressão',ENDO,'Linha Periférica',APT),
 (32,'Dredger™','Cateter de suporte',ENDO,'Linha Periférica',APT),
 (33,'sinus-SuperFlex-635','Stent superflexível 6F com design híbrido sinus-Micro-Mesh',ENDO,'Linha Periférica',OPT),
 (35,'sinus-Obliquus®','Stent venoso dedicado para precisão em anatomia ilíaca desafiadora',ENDO,'Linha Venosa',OPT),
 (36,'sinus-XL Family','Stents autoexpansíveis de nitinol para aorta e veia cava',ENDO,'Linha Venosa',OPT),
 (37,'sinus-Venous','Excelência venosa dedicada para stent em território iliofemoral',ENDO,'Linha Venosa',OPT),
 (39,'Distail™ Bonbon','Balloon occlusion microcateter',ENDO,'Embolização',APT),
 (40,'Distail™','Microcateter para intervenção periférica',ENDO,'Embolização',APT),
 (42,'Braidin™ TIPS','Conjunto de acesso hepático transjugular',ENDO,'TIPS',APT),
 (44,'ZYLOX Unicorn™','Sistema de fechamento vascular',ENDO,'Fechamento Vascular',ZYL),
 (46,'ShockFast™','Sistema de litotripsia intravascular coronária (C-IVL)',IVL,'',SHUN),
 (47,'ShockFast™ Peripheral','Sistema de litotripsia intravascular periférica (P-IVL)',IVL,'',SHUN),
 (50,'Kit Introdutor Radial e Femoral','Kit introdutor',ACES,'Acesso Vascular',SHUN),
 (51,'Shoocin™','Kit introdutor',ACES,'Acesso Vascular',LEPU),
 (52,'Braidin™ Introducer Kit 6F','Kit introdutor para acesso vascular 6F',ACES,'Acesso Vascular',APT),
 (53,'Sailwire™','Bainha guia',ACES,'Acesso Vascular',APT),
 (55,'Shun Skyline™','Fio-guia revestido em PTFE',ACES,'Fios-Guia e Navegação',SHUN),
 (56,'Blackeel','Fio-guia hidrofílico',ACES,'Fios-Guia e Navegação',APT),
 (57,'Ultraskin™','Fio-guia hidrofílico',ACES,'Fios-Guia e Navegação',LEPU),
 (58,'Susrail™','Fio-guia de alto suporte',ACES,'Fios-Guia e Navegação',APT),
 (59,'Guiroad™','Fio-guia para intervenção periférica',ACES,'Fios-Guia e Navegação',APT),
 (61,'Angiopower™','Insuflador / dispositivo de insuflação',ACES,'Insuflação e Suporte',LEPU),
 (63,'Angioway','Manifolds e extensões de alta pressão',ACES,'Contraste e Fluidos',LEPU),
 (64,'Angioway High Pressure','Tubo extensor de alta pressão',ACES,'Contraste e Fluidos',LEPU),
 (66,'Rayband™','Dispositivo de compressão da artéria radial',ACES,'Hemostasia',LEPU),
 (68,'AngioPointer™','Cateter diagnóstico angiográfico hidrofílico',ACES,'Diagnóstico',APT),
]

def slug(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def plain(s):
    return re.sub(r'\s+', ' ', s.replace('®', '').replace('™', '')).strip()

def cover(page, path):
    z = 700 / page.rect.width
    page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False).save(path, jpg_quality=82)

def main(src):
    root = Path(__file__).resolve().parent.parent / 'seed'
    shutil.rmtree(root, ignore_errors=True)
    (root / 'arquivos').mkdir(parents=True)
    (root / 'capas').mkdir()
    d = fitz.open(src)
    assert d.page_count == 69, d.page_count
    shutil.copyfile(src, root / 'arquivos' / 'consolidado.pdf')
    cover(d[0], root / 'capas' / 'consolidado.jpg')
    items = [{
        'kind': 'consolidado', 'slug': 'consolidado', 'name': 'Catálogo Sellmed Brasil',
        'description': 'Todo o portfólio em um único documento, organizado por área e linha.',
        'area': '', 'line': '', 'manufacturer': '', 'version': '', 'sortOrder': 0, 'pages': d.page_count,
        'fileName': 'Catalogo Sellmed Brasil.pdf', 'file': 'arquivos/consolidado.pdf', 'cover': 'capas/consolidado.jpg',
    }]
    for i, (pg, name, desc, area, line, mfr) in enumerate(P):
        s = slug(plain(name))
        out = fitz.open()
        out.insert_pdf(d, from_page=pg - 1, to_page=pg - 1, links=False, annots=False)
        out.set_metadata({'title': f'{plain(name)} - Catálogo Sellmed Brasil', 'author': 'Sellmed Brasil'})
        out.save(root / 'arquivos' / f'{s}.pdf', garbage=4, deflate=True)
        out.close()
        cover(d[pg - 1], root / 'capas' / f'{s}.jpg')
        items.append({'kind': 'produto', 'slug': s, 'name': name, 'description': desc, 'area': area, 'line': line,
                      'manufacturer': mfr, 'version': '', 'sortOrder': (i + 1) * 10, 'pages': 1,
                      'fileName': f'Catalogo {plain(name)}.pdf', 'file': f'arquivos/{s}.pdf', 'cover': f'capas/{s}.jpg'})
    assert len({x['slug'] for x in items}) == len(items) == 50
    (root / 'catalogos.json').write_text(json.dumps(items, ensure_ascii=False, indent=1))
    print(len(items), 'itens em', root)

main(sys.argv[1])
