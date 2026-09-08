# -*- coding: utf-8 -*-
"""PTA-001 — Protocole de test d'apprentissage YAHRIA OS — corps du PDF (ReportLab)."""
import os
import sys
import hashlib

SKILL_SCRIPTS = "/home/z/my-project/skills/pdf/scripts"
if SKILL_SCRIPTS not in sys.path:
    sys.path.insert(0, SKILL_SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, KeepTogether, CondPageBreak,
                                HRFlowable, Image)
from reportlab.platypus.tableofcontents import TableOfContents

import pta_contenu as C

# Typographie française : espace insécable avant tiret cadratin.
def _bind_fr(obj):
    if isinstance(obj, str):
        return obj.replace(' — ', '\u00a0— ')
    if isinstance(obj, list):
        return [_bind_fr(x) for x in obj]
    if isinstance(obj, tuple):
        return tuple(_bind_fr(x) for x in obj)
    return obj

for _k in [k for k in dir(C) if not k.startswith('_')]:
    setattr(C, _k, _bind_fr(getattr(C, _k)))

# ━━ Cascade Palette (générée par design_engine.py palette-cascade, seed 7) ━━
PAGE_BG       = colors.HexColor('#eff0f1')
SECTION_BG    = colors.HexColor('#f0f1f2')
CARD_BG       = colors.HexColor('#e4e7e8')
TABLE_STRIPE  = colors.HexColor('#ebedee')
HEADER_FILL   = colors.HexColor('#334650')
COVER_BLOCK   = colors.HexColor('#5a7886')
BORDER        = colors.HexColor('#b8c8cf')
ICON          = colors.HexColor('#52798c')
ACCENT        = colors.HexColor('#3681a6')
ACCENT_2      = colors.HexColor('#b43a4e')
TEXT_PRIMARY  = colors.HexColor('#1a1b1c')
TEXT_MUTED    = colors.HexColor('#6f7578')
SEM_SUCCESS   = colors.HexColor('#46875c')
SEM_WARNING   = colors.HexColor('#a18347')
SEM_ERROR     = colors.HexColor('#92453e')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = TABLE_STRIPE

# ── Fonts ─────────────────────────────────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Noto Sans SC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Noto Sans SC Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('Noto Sans SC', normal='Noto Sans SC', bold='Noto Sans SC Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

from pdf import install_font_fallback
install_font_fallback()

# ── Layout constants ──────────────────────────────────────────────────────────
MARGIN = 0.9 * inch
PAGE_W, PAGE_H = A4
AVAIL_W = PAGE_W - 2 * MARGIN
AVAIL_H = PAGE_H - 2 * MARGIN
H1_COND = AVAIL_H * 0.25
H2_COND = AVAIL_H * 0.15
MAX_KEEP_HEIGHT = PAGE_H * 0.4

OUT = "/home/z/my-project/scripts/pta_body.pdf"

# ── Styles ────────────────────────────────────────────────────────────────────
body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
                      alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY,
                      spaceBefore=0, spaceAfter=9)
bullet = ParagraphStyle('Bullet', parent=body, alignment=TA_LEFT, leftIndent=16,
                        firstLineIndent=0, spaceAfter=6)
h1s = ParagraphStyle('H1', fontName='FreeSerif', fontSize=22, leading=27,
                     textColor=HEADER_FILL, spaceBefore=18, spaceAfter=4)
h2s = ParagraphStyle('H2', fontName='FreeSerif', fontSize=15, leading=20,
                     textColor=TEXT_PRIMARY, spaceBefore=16, spaceAfter=8)
h3s = ParagraphStyle('H3', fontName='FreeSerif', fontSize=11.5, leading=16,
                     textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6)
caption = ParagraphStyle('Caption', fontName='FreeSerif', fontSize=8.5, leading=12,
                         alignment=TA_CENTER, textColor=TEXT_MUTED,
                         spaceBefore=3, spaceAfter=6)
toc_title_style = ParagraphStyle('TocTitle', parent=h1s, spaceBefore=0)
toc_l0 = ParagraphStyle('TOC0', fontName='FreeSerif', fontSize=12, leading=20,
                        leftIndent=20, textColor=TEXT_PRIMARY)
toc_l1 = ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=10.5, leading=16,
                        leftIndent=40, textColor=TEXT_MUTED)
th_style = ParagraphStyle('TH', fontName='FreeSerif', fontSize=9.5, leading=13,
                          textColor=colors.white, alignment=TA_LEFT)
td_style = ParagraphStyle('TD', fontName='FreeSerif', fontSize=9, leading=13,
                          textColor=TEXT_PRIMARY, alignment=TA_LEFT)
td_center = ParagraphStyle('TDC', parent=td_style, alignment=TA_CENTER)
stat_big = ParagraphStyle('StatBig', fontName='FreeSerif', fontSize=20, leading=24,
                          textColor=ACCENT, alignment=TA_CENTER)
stat_label = ParagraphStyle('StatLabel', fontName='FreeSerif', fontSize=8, leading=11,
                            textColor=TEXT_MUTED, alignment=TA_CENTER)

# ── TOC-aware doc template ────────────────────────────────────────────────────
FRONT_MATTER_PAGES = 1

class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            display_page = self.page - FRONT_MATTER_PAGES
            self.notify('TOCEntry', (level, text, display_page, key))

def add_heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def safe_keep_together(elements):
    total_h = 0
    for el in elements:
        try:
            w, h = el.wrap(AVAIL_W, PAGE_H)
        except Exception:
            h = 0
        total_h += h
    if total_h <= MAX_KEEP_HEIGHT:
        return [KeepTogether(elements)]
    elif len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return list(elements)

def h1_block(text, first_flowables=None):
    head = add_heading(text, h1s, level=0)
    rule = HRFlowable(width='100%', thickness=1.5, color=ACCENT,
                      spaceBefore=2, spaceAfter=12)
    group = [head, rule]
    if first_flowables:
        group += first_flowables
    return [CondPageBreak(H1_COND)] + safe_keep_together(group)

def h2_block(text, first_flowables=None):
    head = add_heading(text, h2s, level=1)
    group = [head] + (first_flowables or [])
    return [CondPageBreak(H2_COND)] + safe_keep_together(group)

def make_table(data, ratios, header=True, center_cols=(), status_col=None):
    col_widths = [r * AVAIL_W for r in ratios]
    assert abs(sum(col_widths) - AVAIL_W) < 1.0, 'table width mismatch'
    wrapped = []
    for ri, row in enumerate(data):
        out_row = []
        for ci, cell in enumerate(row):
            if ri == 0 and header:
                out_row.append(Paragraph('<b>%s</b>' % cell, th_style))
            else:
                style = td_center if ci in center_cols else td_style
                if status_col is not None and ci == status_col:
                    color = {'TERMINÉ': '#46875c', 'PRÊT': '#a18347',
                             'EN ATTENTE': '#92453e', 'ACTIF': '#46875c',
                             'Préparé': '#a18347', 'Prouvé (rapports JSON)': '#46875c',
                             'Appliqué mécaniquement': '#46875c',
                             'Respecté par conception': '#46875c',
                             'Cible du test': '#92453e'}.get(cell, '#1a1b1c')
                    out_row.append(Paragraph('<font color="%s"><b>%s</b></font>'
                                             % (color, cell), td_center))
                else:
                    out_row.append(Paragraph(cell, style))
        wrapped.append(out_row)
    t = Table(wrapped, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for ri in range(1, len(data)):
        style_cmds.append(('BACKGROUND', (0, ri), (-1, ri),
                           TABLE_ROW_ODD if ri % 2 else TABLE_ROW_EVEN))
    t.setStyle(TableStyle(style_cmds))
    return t

def add_table_block(story, data, ratios, cap, **kw):
    story.append(Spacer(1, 12))
    tbl = make_table(data, ratios, **kw)
    if len(data) <= 9:
        story.extend(safe_keep_together([tbl, Spacer(1, 6), Paragraph(cap, caption)]))
    else:
        story.append(tbl)
        story.append(Spacer(1, 6))
        story.append(Paragraph(cap, caption))
    story.append(Spacer(1, 12))

def metrics_row(metrics):
    n = len(metrics)
    cells = []
    for value, label in metrics:
        cells.append([Paragraph('<b>%s</b>' % value, stat_big),
                      Paragraph(label, stat_label)])
    t = Table([cells], colWidths=[AVAIL_W / n] * n, hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('BOX', (0, 0), (-1, -1), 1, ACCENT),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

# ── Header / footer ───────────────────────────────────────────────────────────
DOC_TITLE = C.TITLE

def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 0.55 * inch, DOC_TITLE)
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, PAGE_H - 0.62 * inch, PAGE_W - MARGIN, PAGE_H - 0.62 * inch)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 0.62 * inch, PAGE_W - MARGIN, 0.62 * inch)
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 0.45 * inch, 'YAHRIA Code OS · Protocole PTA-001')
    page_label = 'i' if doc.page <= FRONT_MATTER_PAGES else str(doc.page - FRONT_MATTER_PAGES)
    canvas.drawRightString(PAGE_W - MARGIN, 0.45 * inch, page_label)
    canvas.restoreState()

# ── Chart (matplotlib) — données réelles du calibrage ────────────────────────
def build_chart(path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    stages = [
        ("1. INVENTAIRE", 0),
        ("2. STRUCTURE", 0),
        ("3. SYNTAXE", 60),
        ("4. DÉCOUVERTE", 0),
        ("5. BOOT", 2033),
        ("6. SONDES", 6),
        ("7. OPENAPI", 0),
    ]
    labels = [s[0] for s in stages][::-1]
    values = [s[1] for s in stages][::-1]
    bar_colors = ['#92453e' if s == 0 else '#3681a6' for s in values]
    bar_colors = ['#3681a6' if v > 0 else '#b8c8cf' for v in values]

    fig, ax = plt.subplots(figsize=(7.4, 3.4), dpi=200, constrained_layout=True)
    bars = ax.barh(labels, values, color=bar_colors, edgecolor='none', height=0.6)
    for rect, v in zip(bars, values):
        ax.text(v + 28, rect.get_y() + rect.get_height() / 2,
                ('%d ms' % v) if v > 0 else '< 1 ms',
                va='center', ha='left', fontsize=9.5, color='#1a1b1c')
    ax.set_xlim(0, 2400)
    ax.set_xticks([])
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_visible(False)
    ax.spines['left'].set_color('#b8c8cf')
    ax.tick_params(axis='y', length=0, labelsize=10, colors='#1a1b1c')
    ax.annotate("Livrable défaillant : arrêt à l'étape 2 en 6 ms\n(44 îlots détectés — boot jamais atteint)",
                xy=(0, 5.0), xytext=(700, 4.6), fontsize=9.5, color='#92453e',
                va='center', ha='left',
                arrowprops=dict(arrowstyle='->', color='#92453e', lw=1.2))
    fig.savefig(path)
    plt.close(fig)

CHART_PNG = '/home/z/my-project/scripts/pta_chart.png'
build_chart(CHART_PNG)

def embed_image(path, max_width, max_height):
    from PIL import Image as PILImage
    pil = PILImage.open(path)
    ow, oh = pil.size
    ratio = min(max_width / ow if ow > max_width else 1.0,
                max_height / oh if oh > max_height else 1.0)
    return Image(path, width=ow * ratio, height=oh * ratio)

# ── Story ─────────────────────────────────────────────────────────────────────
story = []

toc = TableOfContents()
toc.levelStyles = [toc_l0, toc_l1]
story.append(Paragraph('<b>Table des matières</b>', toc_title_style))
story.append(HRFlowable(width='100%', thickness=1.5, color=ACCENT, spaceBefore=2, spaceAfter=14))
story.append(toc)
story.append(PageBreak())

# ── 1. Thèse et objet ────────────────────────────────────────────────────────
story += h1_block('1. Thèse et objet du protocole', [Paragraph(C.CH1_P1, body)])
story.append(Paragraph(C.CH1_P2, body))
story.append(Paragraph(C.CH1_P3, body))
story.append(Spacer(1, 10))
story.extend(safe_keep_together([metrics_row(C.METRICS), Spacer(1, 6),
                                 Paragraph('Indicateurs clés du protocole à la date d\'émission', caption)]))
story.append(Spacer(1, 10))

# ── 2. Baseline contrôlée ────────────────────────────────────────────────────
story += h1_block('2. Ligne de base contrôlée : l\'erreur à ne pas répéter')
story += h2_block('2.1 Deux livrables, deux échecs mesurés', [Paragraph(C.CH2_1_P1, body)])
story.append(Paragraph(C.CH2_1_P2, body))
add_table_block(story, C.BASELINE_TABLE, [0.22, 0.40, 0.21, 0.17],
                'Tableau 1 — Ligne de base mesurée : les deux échecs du premier boot')
story += h2_block('2.2 La cause racine commune', [Paragraph(C.CH2_2_P1, body)])

# ── 3. Leviers d'apprentissage ───────────────────────────────────────────────
story += h1_block('3. Les leviers d\'apprentissage')
story += h2_block('3.1 EVO-000020 — YAHRIA sait se mesurer', [Paragraph(C.CH3_1_P1, body)])
story += h2_block('3.2 EVO-000016 — apprendre à ne plus répéter', [Paragraph(C.CH3_2_P1, body)])
add_table_block(story, C.LEVIERS_TABLE, [0.28, 0.14, 0.34, 0.24],
                'Tableau 2 — Les deux leviers du test d\'apprentissage')

# ── 4. La porte exécutable ───────────────────────────────────────────────────
story += h1_block('4. La porte de boot exécutable et son calibrage')
story += h2_block('4.1 Sept étapes, de l\'inventaire à l\'OpenAPI', [Paragraph(C.CH4_1_P1, body)])
add_table_block(story, C.GATE_TABLE, [0.16, 0.40, 0.44],
                'Tableau 3 — Les sept étapes de la porte de boot')
story += h2_block('4.2 Rétro-test de calibrage', [Paragraph(C.CH4_2_P1, body)])
story.append(Paragraph(C.CH4_2_P2, body))
story.append(Spacer(1, 18))
chart_img = embed_image(CHART_PNG, AVAIL_W, 240)
story.extend(safe_keep_together([chart_img, Spacer(1, 8), Paragraph(C.CHART_CAPTION, caption)]))
story.append(Spacer(1, 18))
story += h2_block('4.3 Armement gouverné', [Paragraph(C.CH4_3_P1, body)])

# ── 5. Déroulé du test décisif ───────────────────────────────────────────────
story += h1_block('5. Déroulé du test décisif')
story += h2_block('5.1 Phases, acteurs et preuves', [Paragraph(C.CH5_1_P1, body)])
add_table_block(story, C.PHASES_TABLE, [0.09, 0.37, 0.11, 0.13, 0.30],
                'Tableau 4 — Les sept phases du protocole', center_cols=(0, 2, 3), status_col=3)
story += h2_block('5.2 Le RUN-000022 : un test équitable du même domaine', [Paragraph(C.CH5_2_P1, body)])
story += h2_block('5.3 Exécution outillée', [Paragraph(C.CH5_3_P1, body)])

# ── 6. Verdict et gouvernance ────────────────────────────────────────────────
story += h1_block('6. Critères de verdict et gouvernance')
story += h2_block('6.1 Matrice de verdict', [Paragraph(C.CH6_1_P1, body)])
add_table_block(story, C.VERDICT_TABLE, [0.28, 0.40, 0.32],
                'Tableau 5 — Matrice de verdict, définie avant l\'exécution')
story += h2_block('6.2 Invariants invoqués', [Paragraph(C.CH6_2_P1, body)])
add_table_block(story, C.INVARIANTS_TABLE, [0.30, 0.48, 0.22],
                'Tableau 6 — Constitution du test : les invariants appliqués', status_col=2)
story += h2_block('6.3 Frontières assumées', [Paragraph(C.CH6_3_P1, body)])

# ── Build ─────────────────────────────────────────────────────────────────────
doc = TocDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=0.85 * inch,
    title=C.TITLE, author='Z.ai', creator='Z.ai',
    subject='Protocole de test d\'apprentissage — prévalidation boot avant SEALED (EVO-000016) et RUN-000022',
)
doc.multiBuild(story, onFirstPage=on_page, onLaterPages=on_page)
print('BODY OK ->', OUT)
