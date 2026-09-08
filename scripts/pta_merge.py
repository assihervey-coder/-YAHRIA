# -*- coding: utf-8 -*-
"""Fusion couverture (Playwright) + corps (ReportLab) -> PDF final unique (PTA-001)."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page

def insert_cover(cover_pdf, body_pdf, output_pdf):
    writer = PdfWriter()
    cover_page = PdfReader(cover_pdf).pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))
    for page in PdfReader(body_pdf).pages:
        writer.add_page(normalize_page_to_a4(page))
    writer.add_metadata({
        '/Title': 'PTA-001 — Protocole de test d\'apprentissage YAHRIA OS',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Protocole de test d\'apprentissage — prévalidation boot avant SEALED (EVO-000016) et RUN-000022',
    })
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    print('MERGED ->', output_pdf, '| pages:', len(writer.pages))

if __name__ == '__main__':
    insert_cover(
        '/home/z/my-project/scripts/pta_cover.pdf',
        '/home/z/my-project/scripts/pta_body.pdf',
        '/home/z/my-project/download/YAHRIA_PTA-001_Protocole_Test_Apprentissage.pdf',
    )
