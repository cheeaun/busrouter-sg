const fs = require('fs');
const got = require('got');
const cheerio = require('cheerio');

(async() => {
  try {
    const { body } = await got('https://www.mytransport.sg/content/mytransport/map.html');
    const $ = cheerio.load(body);

    const services = [];

    $('#busservice_option optgroup').each((i, el) => {
      const optgroup = $(el);
      const category = optgroup.attr('label').trim();

      optgroup.find('option[value]').each((i, el) => {
        const option = $(el);
        services.push({
          no: option.text().trim(),
          routes: parseInt(option.attr('value').trim().match(/[0-9]$/)[0], 10),
          category,
        });
      });
    });

    console.log(`Services count: ${services.length}`);

    const filePath = 'data/3/services.json';
    fs.writeFileSync(filePath, JSON.stringify(services, null, '\t'));
    console.log(`Generated ${filePath}`);
  } catch (e) {
    console.error(e);
  }
})();
