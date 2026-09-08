# -*- coding: utf-8 -*-
"""Fusion couverture (Playwright) + corps (ReportLab) -> PDF final unique."""
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
        '/Title': 'Audit technique de complétude — YAHRIA OS & RUN-000019',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Audit de complétude technique — plateforme YAHRIA CODE OS et livrable RUN-000019',
    })
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    print('MERGED ->', output_pdf, '| pages:', len(writer.pages))

if __name__ == '__main__':
    insert_cover(
        '/home/z/my-project/scripts/audit_cover.pdf',
        '/home/z/my-project/scripts/audit_body.pdf',
        '/home/z/my-project/download/YAHRIA_Audit_Technique_Completude.pdf',
    )
