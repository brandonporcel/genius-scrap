const { chromium } = require("playwright");

const main = async () => {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const userURL = process.argv[2];
    if (!userURL) {
      console.error("Necesito la URL como argumento.");
      return;
    }

    const isAnAlbum = isAlbum(userURL);

    await page.goto(userURL, {
      waitUntil: "domcontentloaded",
    });

    const pdfTitle = await getPageTitle(page);
    let template = "";

    if (isAnAlbum) {
      template = await getAlbumTemplate(page);
    } else {
      template = await getSongTemplate(page);
    }

    const newHtmlContent = generateHtmlTemplate(template);
    await page.setContent(newHtmlContent);
    await page.pdf({ path: `${pdfTitle}.pdf` });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await context.close();
    await browser.close();
  }
};

const isAlbum = (url) => {
  return url.split("/")[3].includes("albums");
};

const getPageTitle = async (page) => {
  const pageTitleEl = await page.$("h1");
  if (!pageTitleEl) {
    throw new Error("No se encontró el elemento h1 en la página.");
  }

  return await pageTitleEl.innerText();
};

const generateHtmlTemplate = (template) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kindle-Genius</title>
    </head>
    <body>
      ${template}
    </body>
    </html>
  `;
};

const getSongTemplate = async (page) => {
  await page.waitForSelector("#lyrics-root-pin-spacer");

  await page.waitForSelector("h1");
  const title = await page.evaluate(
    () => document.querySelector("h1").outerHTML
  );

  const lyricsSections = await page.evaluate(() => {
    const lyricsPartsNodeList = document.querySelectorAll(
      "#lyrics-root-pin-spacer div[data-lyrics-container]"
    );

    const lyricsParts = [];
    for (let part of lyricsPartsNodeList) {
      lyricsParts.push(part.outerHTML);
    }
    return lyricsParts;
  });

  const htmlTemplate = `
    ${title}${lyricsSections.map((el) => el + "<br>").join("")}
  `;

  return htmlTemplate;
};

const getAlbumTemplate = async (page) => {
  await page.waitForSelector("album-tracklist-row a");
  const links = await page.evaluate(() => {
    const items = document.querySelectorAll("album-tracklist-row a");

    const links = [];
    for (let item of items) {
      links.push(item.href);
    }
    return links;
  });

  let template = "";

  for (let link of links) {
    await page.goto(link, { waitUntil: "domcontentloaded" });
    const songTemplate = await getSongTemplate(page);
    template += songTemplate;

    await page.waitForTimeout(1000);
  }

  return template;
};

main();
