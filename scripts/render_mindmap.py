import asyncio
import os
from playwright.async_api import async_playwright

HTML = '/home/z/my-project/scripts/yahria_mindmap.html'
PNG = '/home/z/my-project/download/YAHRIA_CARTE_ARCHITECTURE.png'

async def mindmap_to_png(html_path, png_path, width=1700):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': width, 'height': 1200}, device_scale_factor=2)
        await page.goto(f'file://{html_path}', wait_until='networkidle')
        await page.wait_for_timeout(500)

        el = page.locator('#mindmap')
        bbox = await el.bounding_box()
        expand_w = max(width, int(bbox['width'] + 100))
        expand_h = int(bbox['height'] + 100)
        await page.set_viewport_size({'width': expand_w, 'height': expand_h})
        await page.wait_for_timeout(200)

        await page.evaluate('if(typeof drawAllLines==="function") drawAllLines()')
        await page.wait_for_timeout(200)

        trim = await page.evaluate('''() => {
            const map = document.getElementById('mindmap');
            const nodes = map.querySelectorAll('.root-node,.branch-node,.sub-node,.leaf,.deep-node');
            const mapRect = map.getBoundingClientRect();
            let maxR = 0, maxB = 0;
            nodes.forEach(n => {
                const r = n.getBoundingClientRect();
                maxR = Math.max(maxR, r.right - mapRect.left);
                maxB = Math.max(maxB, r.bottom - mapRect.top);
            });
            return { contentW: Math.ceil(maxR) + 80, contentH: Math.ceil(maxB) + 80 };
        }''')
        await page.set_viewport_size({'width': trim['contentW'], 'height': trim['contentH']})
        await page.wait_for_timeout(200)
        await page.evaluate('if(typeof drawAllLines==="function") drawAllLines()')
        await page.wait_for_timeout(200)

        await el.screenshot(path=png_path)
        await browser.close()
        print(f'OK {png_path} ({os.path.getsize(png_path)/1024:.0f} KB)')

if __name__ == '__main__':
    asyncio.run(mindmap_to_png(HTML, PNG))
