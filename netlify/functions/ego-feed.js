const https = require('https');
const http = require('http');

const FEED_URL = 'http://feeds.transporter.janeladigital.com/423E0F5F-30FC-4E01-8FE1-99BD7E14B021/0500048808.xml';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function getTag(text, tag) {
  const match = text.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function getAllTags(text, tag) {
  const regex = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'gi');
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const val = match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (val) results.push(val);
  }
  return results;
}

function getLangDesc(propText, lang) {
  const descBlock = propText.match(/<desc>([\s\S]*?)<\/desc>/i);
  if (!descBlock) return '';
  return getTag(descBlock[1], lang);
}

function getImageUrls(propText) {
  const imagesBlock = propText.match(/<images>([\s\S]*?)<\/images>/i);
  if (!imagesBlock) return [];
  return getAllTags(imagesBlock[1], 'url').map(u => u.trim()).filter(Boolean);
}

exports.handler = async function() {
  try {
    const xml = await fetchUrl(FEED_URL);
    const propRegex = /<property>([\s\S]*?)<\/property>/gi;
    const properties = [];
    let match;
    while ((match = propRegex.exec(xml)) !== null) {
      const p = match[1];
      var ref = getTag(p, 'ref');
      var tag = '';
      var cleanRef = ref;
      var tagMatch = ref.match(/\s+(soon|portfolio|sold)$/i);
      if (tagMatch) {
        tag = tagMatch[1].toLowerCase();
        cleanRef = ref.replace(/\s+(soon|portfolio|sold)$/i, '').trim();
      }
      properties.push({
        id: getTag(p, 'id'),
        ref: cleanRef,
        price: parseInt(getTag(p, 'price')) || 0,
        type: getTag(p, 'type'),
        town: getTag(p, 'town'),
        location_detail: getTag(p, 'location_detail'),
        beds: getTag(p, 'beds'),
        baths: getTag(p, 'baths'),
        built: parseInt(getTag(p, 'built')) || 0,
        notes: tag || getTag(p, 'notes').toLowerCase().trim(),
        desc_en: getLangDesc(p, 'en'),
        desc_nl: getLangDesc(p, 'nl'),
        desc_es: getLangDesc(p, 'es'),
        desc_de: getLangDesc(p, 'de'),
        photos: getImageUrls(p),
        features: getAllTags((p.match(/<features>([\s\S]*?)<\/features>/i) || ['',''])[1], 'feature'),
      });
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(properties),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
