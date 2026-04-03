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

function getVideoUrl(propText) {
  // Try all known eGO video field names
  const fields = ['video_url','virtual_tour','tour','video','media_url','youtube','vimeo','tour_url','virtualvisit'];
  for (const f of fields) {
    const m = propText.match(new RegExp('<' + f + '[^>]*>([^<]+)<\\/' + f + '>', 'i'));
    if (m && m[1].trim()) return m[1].trim();
  }
  // Also look for YouTube/Vimeo URLs in description text
  const allText = propText.replace(/<!\[CDATA\[|\]\]>/g, '');
  const ytMatch = allText.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return 'https://www.youtube.com/embed/' + ytMatch[1];
  const vmMatch = allText.match(/https?:\/\/(?:www\.)?vimeo\.com\/(\d+)/);
  if (vmMatch) return 'https://player.vimeo.com/video/' + vmMatch[1];
  return null;
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
      var sortOrder = 999;
      var cleanRef = ref;
      var orderMatch = ref.match(/#(\d+)\s*$/);
      if (orderMatch) {
        sortOrder = parseInt(orderMatch[1]);
        ref = ref.replace(/#\d+\s*$/, '').trim();
        cleanRef = ref;
      }
      var tagMatch = ref.match(/\s+(soon|portfolio|sold)$/i);
      if (tagMatch) {
        tag = tagMatch[1].toLowerCase();
        cleanRef = ref.replace(/\s+(soon|portfolio|sold)$/i, '').trim();
      }
      var lat = 0, lon = 0;
      var locBlock = p.match(/<location>([\s\S]*?)<\/location>/i);
      if (locBlock) {
        lat = parseFloat(getTag(locBlock[1], 'latitude')) || 0;
        lon = parseFloat(getTag(locBlock[1], 'longitude')) || 0;
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
        gross: parseInt(getTag(p, 'gross_area')) || parseInt(getTag(p, 'area_gross')) || parseInt(getTag(p, 'gross')) || parseInt(getTag(p, 'area_total')) || parseInt(getTag(p, 'total_area')) || parseInt(getTag(p, 'usable_area')) || parseInt(getTag(p, 'living_area')) || parseInt(getTag(p, 'area')) || 0,
        plot: parseInt(getTag(p, 'plot')) || parseInt(getTag(p, 'land_area')) || parseInt(getTag(p, 'area_land')) || 0,
        _area_debug: (function() {
          var areaBlock = p.match(/<areas?[^>]*>([\s\S]*?)<\/areas?>/i);
          return areaBlock ? areaBlock[0].replace(/<!\[CDATA\[|\]\]>/g, '').substring(0, 500) : '';
        })(),
        notes: tag || getTag(p, 'notes').toLowerCase().trim(),
        sort_order: sortOrder,
        lat: lat,
        lon: lon,
        desc_en: getLangDesc(p, 'en'),
        desc_nl: getLangDesc(p, 'nl'),
        desc_es: getLangDesc(p, 'es'),
        desc_de: getLangDesc(p, 'de'),
        photos: getImageUrls(p),
        video_url: getVideoUrl(p),
        features: getAllTags((p.match(/<features>([\s\S]*?)<\/features>/i) || ['',''])[1], 'feature'),
      });
    }
    properties.sort(function(a,b){ return a.sort_order - b.sort_order; });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(properties),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
