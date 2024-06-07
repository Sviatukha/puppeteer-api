// файл: index.mjs

import puppeteer from 'puppeteer';
import { prepearBody } from './prepearBody.mjs';
import { secureURL } from './secureUrl.mjs';

export const handler = async (preset, fonts, start) => {
  let browser = null;
  let result = null;

  try {
    browser = await puppeteer.launch({
      // executablePath: '/opt/render/.cache/puppeteer/chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const version = await browser.version();

    console.log(version);

    const page = await browser.newPage();

    await page.setContent(
      `
      <html>
      <head>
        
      </head>
      <body>
      </body>
      </html>
    `,
      { waitUntil: 'networkidle0' }
    );

    const pageTime = Date.now();

    console.log('page created------', pageTime - start);

    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/4.5.0/fabric.min.js',
    });

    const fabricTime = Date.now();

    console.log('fabric loadded-------', fabricTime - start);

    page.on('console', (msg) => {
      console.log('PAGE LOG:', msg.text());
    });

    const fontsArr = fonts.map((font) => ({
      name: font.name,
      path: secureURL(font.path),
    }));

    await page.evaluate(
      async ({ readedFonts }) => {
        const promisesArr = readedFonts.map(async (font) => {
          const fontFace = new FontFace(font.name, `url(${font.path})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          console.log('font added', font.name);
        });

        await Promise.all(promisesArr);
      },
      {
        readedFonts: fontsArr,
      }
    );

    const fontsTime = Date.now();
    console.log('fonts added-------', fontsTime - start);

    await prepearBody(preset.body.objects);
    // preset.body.objects = preset.body.objects.filter((object) => {
    //   return object.type !== 'image';
    // });
    const prepearTime = Date.now();
    console.log('body prepared----------', prepearTime - start);

    const canvasImage = await page.evaluate(
      async ({ template, start }) => {
        const canvasElement = document.createElement('canvas');
        console.log('canvas created');
        canvasElement.width = template.width;
        canvasElement.height = template.height;
        document.body.appendChild(canvasElement);

        const canvas = new fabric.Canvas(canvasElement);
        const fabricTime = Date.now();
        console.log('fabricCanvas  created-------', fabricTime - start);
        const base64 = await new Promise((resolve) => {
          canvas.loadFromJSON(JSON.stringify(template.body), () => {
            const imageFilters = {
              mask_filter: 1,
              opacity_filter: 2,
              blur_filter: 3,
              blend_filter: 5,
            };
            const jsonTime = Date.now();
            console.log('json parsed----------', jsonTime - start);
            const objects = canvas.getObjects();

            const setFilters = (element) => {
              for (const [filterName, filterIndex] of Object.entries(
                imageFilters
              )) {
                let value = element?.appliedFilters[filterName]?.value;
                let params = element?.appliedFilters[filterName]?.params;

                if (value) {
                  element.filters[filterIndex] = new fabric.Image.filters[
                    value
                  ](
                    filterIndex === 3
                      ? { blur: parseFloat(params.blur) }
                      : { ...params }
                  );
                }
              }

              element.applyFilters();
            };

            const applyFilters = (objects) => {
              objects?.forEach((object) => {
                if (
                  object.className === 'multiGroup' ||
                  object.className === 'containerForPicture'
                ) {
                  applyFilters(object._objects);
                }
                if (object.appliedFilters) {
                  setFilters(object);
                }
              });
            };

            applyFilters(objects);

            const filterTime = Date.now();
            console.log('filters applied----------', filterTime - start);

            canvas.renderAll();
            console.log('<<<canvas rendered>>');
            const base64 = canvas.toDataURL();

            resolve(base64);
          });
        });
        return base64;
      },
      { template: preset, start }
    );

    result = {
      statusCode: 200,
      body: JSON.stringify(canvasImage),
    };
  } catch (error) {
    console.error(error);
    result = {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return result;
};
